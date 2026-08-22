/**
 * Sandbox Keys API
 * GET  /api/v1/keys        - List user's keys
 * POST /api/v1/keys        - Generate a new key
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateSandboxKey, hashSandboxKey, getKeyPrefix } from "@/lib/crypto";
import { z } from "zod";

const createKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  providerId: z.string().min(1),
  projectId: z.string().optional(),
  testSessionId: z.string().optional(),
  maxRequests: z.number().int().min(1).max(1000).default(25),
  maxTokens: z.number().int().min(1000).max(1000000).default(20000),
  maxRatePer60s: z.number().int().min(1).max(60).default(10),
  lifetimeSeconds: z.number().int().min(60).max(86400).default(3600),
  allowedModels: z.array(z.string()).optional().default([]),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const projectId = searchParams.get("projectId");

  const keys = await prisma.sandboxKey.findMany({
    where: {
      userId: session.user.id,
      ...(status && { status }),
      ...(projectId && { projectId }),
    },
    include: {
      provider: { select: { name: true, displayName: true } },
      project: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Mask key hash — never return it, and parse SQLite serialized JSON fields
  const safeKeys = keys.map(({ keyHash: _, ...key }) => {
    let parsedSimFlags = {};
    if (typeof key.simulationFlags === "string") {
      try {
        parsedSimFlags = JSON.parse(key.simulationFlags || "{}");
      } catch {
        parsedSimFlags = {};
      }
    } else if (key.simulationFlags) {
      parsedSimFlags = key.simulationFlags;
    }

    return {
      ...key,
      simulationFlags: parsedSimFlags,
      allowedModels: typeof key.allowedModels === "string" ? (key.allowedModels ? key.allowedModels.split(",") : []) : (key.allowedModels ?? []),
      keyPreview: key.keyPrefix + "...",
    };
  });

  return NextResponse.json({ keys: safeKeys });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = createKeySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
    }

    const data = parsed.data;

    // Check user's active key limit
    const activeCount = await prisma.sandboxKey.count({
      where: {
        userId: session.user.id,
        status: { in: ["ACTIVE", "CREATED"] },
        expiresAt: { gt: new Date() },
      },
    });
    const maxActive = parseInt(process.env.MAX_ACTIVE_KEYS_PER_USER ?? "5");
    if (activeCount >= maxActive) {
      return NextResponse.json(
        { error: `You can have at most ${maxActive} active keys. Revoke existing keys first.` },
        { status: 429 }
      );
    }

    // Validate provider exists and is enabled
    const provider = await prisma.provider.findFirst({
      where: { id: data.providerId, isEnabled: true },
    });
    if (!provider) {
      return NextResponse.json({ error: "Provider not found or not enabled" }, { status: 404 });
    }

    // Generate cryptographically secure key
    const rawKey = generateSandboxKey();
    const keyHash = await hashSandboxKey(rawKey);
    const keyPrefix = getKeyPrefix(rawKey);

    const expiresAt = new Date(Date.now() + data.lifetimeSeconds * 1000);

    const sandboxKey = await prisma.sandboxKey.create({
      data: {
        userId: session.user.id,
        providerId: data.providerId,
        projectId: data.projectId,
        testSessionId: data.testSessionId,
        keyPrefix,
        keyHash,
        name: data.name,
        maxRequests: Math.min(data.maxRequests, provider.defaultMaxRequests),
        maxTokens: Math.min(data.maxTokens, provider.defaultMaxTokens),
        maxRatePer60s: data.maxRatePer60s,
        expiresAt,
        allowedModels: Array.isArray(data.allowedModels) ? data.allowedModels.join(",") : (data.allowedModels ?? ""),
        simulationFlags: JSON.stringify({}),
        status: "ACTIVE",
      },
      include: {
        provider: { select: { name: true, displayName: true } },
      },
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "KEY_GENERATED",
        targetType: "sandbox_key",
        targetId: sandboxKey.id,
        metadata: JSON.stringify({ provider: provider.name, maxRequests: data.maxRequests }),
      },
    });

    // Return the key ONCE — never again
    return NextResponse.json(
      {
        key: {
          ...sandboxKey,
          simulationFlags: {},
          allowedModels: data.allowedModels,
          keyHash: undefined,
          secretKey: rawKey,
        },
        warning: "Save this key now. It will not be shown again.",
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[Keys] Create error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
