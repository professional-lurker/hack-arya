/**
 * Quota management module.
 * Checks and updates request/token quotas for sandbox keys.
 * All quota operations are authoritative — never trust client-side values.
 */

import { prisma } from "../db";

export type KeyStatus = "ACTIVE" | "CREATED" | "EXPIRED" | "EXHAUSTED" | "REVOKED" | "SUSPENDED";

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  requestsRemaining: number;
  tokensRemaining: number;
  expiresAt: Date;
}

/**
 * Check whether a sandbox key has quota available.
 * Does NOT increment counters — call recordUsage() after successful request.
 */
export async function checkQuota(keyId: string): Promise<QuotaCheckResult> {
  const key = await prisma.sandboxKey.findUnique({
    where: { id: keyId },
    select: {
      status: true,
      expiresAt: true,
      maxRequests: true,
      maxTokens: true,
      requestsUsed: true,
      tokensUsed: true,
    },
  });

  if (!key) {
    return {
      allowed: false,
      reason: "Key not found",
      requestsRemaining: 0,
      tokensRemaining: 0,
      expiresAt: new Date(),
    };
  }

  // Check expiration
  if (key.expiresAt < new Date()) {
    // Auto-expire the key
    await prisma.sandboxKey.update({
      where: { id: keyId },
      data: { status: "EXPIRED" },
    });
    return {
      allowed: false,
      reason: "Key has expired",
      requestsRemaining: 0,
      tokensRemaining: 0,
      expiresAt: key.expiresAt,
    };
  }

  // Check status
  if (key.status !== "ACTIVE" && key.status !== "CREATED") {
    return {
      allowed: false,
      reason: `Key is ${key.status.toLowerCase()}`,
      requestsRemaining: 0,
      tokensRemaining: 0,
      expiresAt: key.expiresAt,
    };
  }

  const requestsRemaining = key.maxRequests - key.requestsUsed;
  const tokensRemaining = key.maxTokens - key.tokensUsed;

  if (requestsRemaining <= 0) {
    await prisma.sandboxKey.update({
      where: { id: keyId },
      data: { status: "EXHAUSTED", exhaustedAt: new Date() },
    });
    return {
      allowed: false,
      reason: "Request quota exhausted",
      requestsRemaining: 0,
      tokensRemaining,
      expiresAt: key.expiresAt,
    };
  }

  if (tokensRemaining <= 0) {
    await prisma.sandboxKey.update({
      where: { id: keyId },
      data: { status: "EXHAUSTED", exhaustedAt: new Date() },
    });
    return {
      allowed: false,
      reason: "Token quota exhausted",
      requestsRemaining,
      tokensRemaining: 0,
      expiresAt: key.expiresAt,
    };
  }

  return {
    allowed: true,
    requestsRemaining,
    tokensRemaining,
    expiresAt: key.expiresAt,
  };
}

/**
 * Atomically increment usage counters after a successful request.
 * Returns the updated key status.
 */
export async function recordUsage(
  keyId: string,
  tokensUsed: number
): Promise<{ status: string; requestsRemaining: number; tokensRemaining: number }> {
  const updated = await prisma.sandboxKey.update({
    where: { id: keyId },
    data: {
      requestsUsed: { increment: 1 },
      tokensUsed: { increment: tokensUsed },
    },
    select: {
      status: true,
      maxRequests: true,
      maxTokens: true,
      requestsUsed: true,
      tokensUsed: true,
    },
  });

  const requestsRemaining = Math.max(0, updated.maxRequests - updated.requestsUsed);
  const tokensRemaining = Math.max(0, updated.maxTokens - updated.tokensUsed);

  // Auto-transition to EXHAUSTED if quota reached
  if (requestsRemaining === 0 || tokensRemaining === 0) {
    await prisma.sandboxKey.update({
      where: { id: keyId },
      data: { status: "EXHAUSTED", exhaustedAt: new Date() },
    });
    return { status: "EXHAUSTED", requestsRemaining, tokensRemaining };
  }

  return {
    status: updated.status,
    requestsRemaining,
    tokensRemaining,
  };
}
