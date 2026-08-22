/**
 * Admin key management — revoke any key
 * PATCH /api/v1/admin/keys/[id]
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { action } = await req.json();

  if (action === "revoke") {
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
        metadata: JSON.stringify({ source: "admin" }),
      },
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
