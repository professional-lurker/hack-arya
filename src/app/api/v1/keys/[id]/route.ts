/**
 * Sandbox Key details and management API
 * GET    /api/v1/keys/:id - Get key details
 * PATCH  /api/v1/keys/:id - Update key (name, simulation flags)
 * DELETE /api/v1/keys/:id - Revoke key immediately
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  simulationFlags: z
    .object({
      rate_limit: z.boolean().optional(),
      quota_exhausted: z.boolean().optional(),
      timeout: z.boolean().optional(),
      provider_unavailable: z.boolean().optional(),
      auth_failed: z.boolean().optional(),
      custom_status: z.number().optional(),
    })
    .optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const key = await prisma.sandboxKey.findFirst({
    where: { id, userId: session.user.id },
    include: {
      provider: { select: { name: true, displayName: true } },
      project: { select: { name: true } },
      testSession: { select: { name: true } },
      _count: {
        select: { apiRequests: true },
      },
    },
  });

  if (!key) return NextResponse.json({ error: "Key not found" }, { status: 404 });

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

  const { keyHash: _, ...safeKey } = key;
  return NextResponse.json({
    key: {
      ...safeKey,
      simulationFlags: parsedSimFlags,
      allowedModels: typeof key.allowedModels === "string" ? (key.allowedModels ? key.allowedModels.split(",") : []) : (key.allowedModels ?? []),
    },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const key = await prisma.sandboxKey.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!key) return NextResponse.json({ error: "Key not found" }, { status: 404 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const updated = await prisma.sandboxKey.update({
    where: { id },
    data: {
      ...(parsed.data.name && { name: parsed.data.name }),
      ...(parsed.data.simulationFlags !== undefined && {
        simulationFlags: JSON.stringify(parsed.data.simulationFlags),
      }),
    },
    include: {
      provider: { select: { name: true, displayName: true } },
    },
  });

  let parsedSimFlags = {};
  if (typeof updated.simulationFlags === "string") {
    try {
      parsedSimFlags = JSON.parse(updated.simulationFlags || "{}");
    } catch {
      parsedSimFlags = {};
    }
  } else if (updated.simulationFlags) {
    parsedSimFlags = updated.simulationFlags;
  }

  const { keyHash: _, ...safeKey } = updated;
  return NextResponse.json({
    key: {
      ...safeKey,
      simulationFlags: parsedSimFlags,
      allowedModels: typeof updated.allowedModels === "string" ? (updated.allowedModels ? updated.allowedModels.split(",") : []) : (updated.allowedModels ?? []),
    },
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const key = await prisma.sandboxKey.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!key) return NextResponse.json({ error: "Key not found" }, { status: 404 });

  await prisma.sandboxKey.update({
    where: { id },
    data: { status: "REVOKED", revokedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      actorId: session.user.id,
      action: "KEY_REVOKED",
      targetType: "sandbox_key",
      targetId: id,
    },
  });

  return NextResponse.json({ message: "Key revoked successfully" });
}
