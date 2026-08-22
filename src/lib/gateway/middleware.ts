/**
 * Core API Gateway middleware.
 *
 * This module validates incoming requests from developers using their
 * temporary sandbox keys (tmp_xxx), enforces all quotas and rate limits,
 * handles failure simulation, routes to the correct provider, and logs
 * every request.
 *
 * Gateway pipeline:
 *   1. Extract Bearer token from Authorization header
 *   2. Hash the token and look up the sandbox key
 *   3. Verify key status (ACTIVE, not expired, not exhausted)
 *   4. Check per-key, per-user, and per-IP rate limits
 *   5. Check request/token quotas
 *   6. Check failure simulation flags
 *   7. Route to provider adapter
 *   8. Record usage
 *   9. Return normalized response
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../db";
import { verifySandboxKey, generateRequestId, hashIp } from "../crypto";
import { getProvider } from "../providers";
import { checkQuota, recordUsage } from "./quota";
import { checkKeyRateLimit, checkUserRateLimit, checkIpRateLimit } from "./rate-limit";
import type { ChatRequest } from "../providers/base";

// Failure simulation types
type SimulationFlag =
  | "rate_limit"
  | "quota_exhausted"
  | "timeout"
  | "provider_unavailable"
  | "auth_failed"
  | "malformed_response";

interface SimulationFlags {
  [key: string]: boolean;
}

// Standard error response format
function gatewayError(
  type: string,
  message: string,
  statusCode: number,
  requestId: string,
  extra?: Record<string, unknown>
): NextResponse {
  return NextResponse.json(
    {
      error: {
        type,
        message,
        request_id: requestId,
        ...extra,
      },
    },
    { status: statusCode }
  );
}

/**
 * Authenticate a sandbox key from the Authorization header.
 * Returns the full sandbox key DB record if valid.
 */
async function authenticateKey(authHeader: string | null) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const rawKey = authHeader.slice(7).trim();
  if (!rawKey.startsWith("tmp_")) return null;

  // Look up all active keys with the same prefix (first 14 chars)
  const prefix = rawKey.substring(0, 14);
  const candidates = await prisma.sandboxKey.findMany({
    where: {
      keyPrefix: prefix,
      status: { in: ["ACTIVE", "CREATED"] },
      expiresAt: { gt: new Date() },
    },
    include: {
      user: { select: { id: true, role: true, isSuspended: true } },
      provider: true,
    },
  });

  for (const candidate of candidates) {
    const valid = await verifySandboxKey(rawKey, candidate.keyHash);
    if (valid) return candidate;
  }
  return null;
}

/**
 * Main gateway handler — call this from the /api/v1/chat/completions route.
 */
export async function handleGatewayRequest(req: NextRequest): Promise<NextResponse> {
  const requestId = generateRequestId();
  const startedAt = Date.now();

  // ── 1. Authenticate ───────────────────────────────────────────────────────
  const sandboxKey = await authenticateKey(req.headers.get("authorization"));
  if (!sandboxKey) {
    return gatewayError(
      "authentication_failed",
      "Invalid or missing API key. Provide a valid tmp_ key via Authorization: Bearer <key>.",
      401,
      requestId
    );
  }

  if (sandboxKey.user.isSuspended) {
    return gatewayError("account_suspended", "Your account has been suspended.", 403, requestId);
  }

  // ── 2. Rate limiting ─────────────────────────────────────────────────────
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ipHash = hashIp(ip);

  const [keyRl, userRl, ipRl] = await Promise.all([
    checkKeyRateLimit(sandboxKey.id, sandboxKey.maxRatePer60s),
    checkUserRateLimit(sandboxKey.userId),
    checkIpRateLimit(ipHash),
  ]);

  if (!keyRl.allowed) {
    return gatewayError(
      "rate_limit_exceeded",
      `Key rate limit exceeded. Maximum ${sandboxKey.maxRatePer60s} requests per minute.`,
      429,
      requestId,
      { retry_after: keyRl.resetInSeconds }
    );
  }
  if (!userRl.allowed) {
    return gatewayError(
      "rate_limit_exceeded",
      "User rate limit exceeded. Try again in a minute.",
      429,
      requestId,
      { retry_after: userRl.resetInSeconds }
    );
  }
  if (!ipRl.allowed) {
    return gatewayError(
      "rate_limit_exceeded",
      "Too many requests from this IP address.",
      429,
      requestId,
      { retry_after: ipRl.resetInSeconds }
    );
  }

  // ── 3. Quota check ────────────────────────────────────────────────────────
  const quota = await checkQuota(sandboxKey.id);
  if (!quota.allowed) {
    return gatewayError(
      quota.reason === "Key has expired" ? "key_expired" : "quota_exceeded",
      quota.reason ?? "Quota exceeded",
      quota.reason === "Key has expired" ? 401 : 429,
      requestId,
      {
        requests_remaining: quota.requestsRemaining,
        tokens_remaining: quota.tokensRemaining,
      }
    );
  }

  // ── 4. Parse request body ─────────────────────────────────────────────────
  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return gatewayError("invalid_request", "Request body must be valid JSON.", 400, requestId);
  }

  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return gatewayError("invalid_request", "messages array is required and must not be empty.", 400, requestId);
  }

  // ── 5. Failure simulation ─────────────────────────────────────────────────
  let simFlags: SimulationFlags = {};
  if (typeof sandboxKey.simulationFlags === "string") {
    try {
      simFlags = JSON.parse(sandboxKey.simulationFlags || "{}");
    } catch {
      simFlags = {};
    }
  } else if (sandboxKey.simulationFlags) {
    simFlags = sandboxKey.simulationFlags as SimulationFlags;
  }

  if (simFlags.rate_limit) {
    await logRequest(requestId, sandboxKey, body.model, 0, 0, "RATE_LIMITED", startedAt, true, "rate_limit", null);
    return gatewayError("rate_limit_exceeded", "[SIMULATED] Rate limit exceeded.", 429, requestId);
  }
  if (simFlags.quota_exhausted) {
    await logRequest(requestId, sandboxKey, body.model, 0, 0, "QUOTA_EXCEEDED", startedAt, true, "quota_exhausted", null);
    return gatewayError("quota_exceeded", "[SIMULATED] Quota exhausted.", 429, requestId);
  }
  if (simFlags.auth_failed) {
    await logRequest(requestId, sandboxKey, body.model, 0, 0, "AUTH_FAILED", startedAt, true, "auth_failed", null);
    return gatewayError("authentication_failed", "[SIMULATED] Authentication failure.", 401, requestId);
  }
  if (simFlags.provider_unavailable) {
    await logRequest(requestId, sandboxKey, body.model, 0, 0, "PROVIDER_ERROR", startedAt, true, "provider_unavailable", null);
    return gatewayError("provider_unavailable", "[SIMULATED] Provider is unavailable.", 503, requestId);
  }
  if (simFlags.timeout) {
    await new Promise((resolve) => setTimeout(resolve, 30000)); // simulate 30s timeout
    return gatewayError("timeout", "[SIMULATED] Request timed out.", 504, requestId);
  }

  // ── 6. Route to provider ──────────────────────────────────────────────────
  const providerName = sandboxKey.provider.name;
  const provider = getProvider(providerName);
  if (!provider) {
    return gatewayError("provider_unavailable", `Provider ${providerName} is not configured.`, 503, requestId);
  }

  // ── 7. Call provider ──────────────────────────────────────────────────────
  let responseData: Awaited<ReturnType<typeof provider.chat>>;
  try {
    responseData = await Promise.race([
      provider.chat({
        model: body.model ?? "gemini-2.0-flash-lite",
        messages: body.messages,
        temperature: body.temperature,
        maxTokens: body.maxTokens,
        systemPrompt: body.systemPrompt,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 30000)
      ),
    ]);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown provider error";
    console.error(`[Gateway] Provider error (${providerName}):`, errMsg);
    return gatewayError("provider_error", `Provider error: ${errMsg}`, 502, requestId, {
      provider: providerName,
    });
  }

  // ── 8. Record usage ───────────────────────────────────────────────────────
  const { requestsRemaining, tokensRemaining } = await recordUsage(
    sandboxKey.id,
    responseData.usage.totalTokens
  );

  await logRequest(
    requestId,
    sandboxKey,
    responseData.model,
    responseData.usage.inputTokens,
    responseData.usage.outputTokens,
    "SUCCESS",
    startedAt,
    false,
    null,
    null
  );

  // ── 9. Return normalized response ─────────────────────────────────────────
  return NextResponse.json(
    {
      id: responseData.id,
      object: "chat.completion",
      model: responseData.model,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: responseData.content },
          finish_reason: responseData.finishReason,
        },
      ],
      usage: {
        prompt_tokens: responseData.usage.inputTokens,
        completion_tokens: responseData.usage.outputTokens,
        total_tokens: responseData.usage.totalTokens,
      },
      // Sandbox metadata
      sandbox: {
        request_id: requestId,
        provider: providerName,
        latency_ms: responseData.latencyMs,
        requests_remaining: requestsRemaining,
        tokens_remaining: tokensRemaining,
        quota_expires_at: quota.expiresAt,
      },
    },
    {
      status: 200,
      headers: {
        "X-Request-Id": requestId,
        "X-Sandbox-Provider": providerName,
        "X-Sandbox-Requests-Remaining": String(requestsRemaining),
        "X-Sandbox-Tokens-Remaining": String(tokensRemaining),
      },
    }
  );
}

// ── Request logging helper ──────────────────────────────────────────────────

async function logRequest(
  requestId: string,
  sandboxKey: { id: string; userId: string; providerId: string },
  modelId: string | undefined,
  inputTokens: number,
  outputTokens: number,
  status: string,
  startedAt: number,
  wasSimulated: boolean,
  simulationType: string | null,
  errorMessage: string | null
) {
  try {
    await prisma.apiRequest.create({
      data: {
        requestId,
        userId: sandboxKey.userId,
        sandboxKeyId: sandboxKey.id,
        providerId: sandboxKey.providerId,
        modelId: modelId ?? "unknown",
        startedAt: new Date(startedAt),
        completedAt: new Date(),
        latencyMs: Date.now() - startedAt,
        status: status as never,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        wasSimulated,
        simulationType,
        errorMessage,
        httpStatusCode: status === "SUCCESS" ? 200 : 400,
      },
    });
  } catch (err) {
    console.error("[Gateway] Failed to log request:", err);
  }
}
