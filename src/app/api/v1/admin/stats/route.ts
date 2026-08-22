/**
 * Admin API — requires ADMIN or SUPER_ADMIN role
 * GET /api/v1/admin/stats
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

function requireAdmin(role: string) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export async function GET() {
  const session = await auth();
  if (!session || !requireAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    totalUsers,
    activeUsers,
    totalKeys,
    activeKeys,
    totalRequests,
    todayRequests,
    providers,
    recentAuditLogs,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true, isSuspended: false } }),
    prisma.sandboxKey.count(),
    prisma.sandboxKey.count({
      where: { status: { in: ["ACTIVE", "CREATED"] }, expiresAt: { gt: now } },
    }),
    prisma.apiRequest.count(),
    prisma.apiRequest.count({ where: { startedAt: { gte: todayStart } } }),
    prisma.provider.findMany({
      include: {
        models: { select: { id: true, isEnabled: true } },
        _count: { select: { sandboxKeys: true, apiRequests: true } },
      },
    }),
    prisma.auditLog.findMany({
      include: { actor: { select: { email: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const tokenSum = await prisma.apiRequest.aggregate({
    _sum: { totalTokens: true, estimatedCostUsd: true },
  });

  return NextResponse.json({
    stats: {
      totalUsers,
      activeUsers,
      totalKeys,
      activeKeys,
      totalRequests,
      todayRequests,
      totalTokens: tokenSum._sum.totalTokens ?? 0,
      estimatedCostUsd: tokenSum._sum.estimatedCostUsd ?? 0,
    },
    providers,
    recentAuditLogs,
  });
}
