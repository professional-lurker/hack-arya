/**
 * Usage/analytics API
 * GET /api/v1/usage - Dashboard usage stats for current user
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    activeKeys,
    expiredKeys,
    totalRequests,
    todayRequests,
    successRequests,
    recentRequests,
    latencyData,
  ] = await Promise.all([
    prisma.sandboxKey.count({
      where: { userId, status: { in: ["ACTIVE", "CREATED"] }, expiresAt: { gt: now } },
    }),
    prisma.sandboxKey.count({
      where: { userId, status: { in: ["EXPIRED", "EXHAUSTED", "REVOKED"] } },
    }),
    prisma.apiRequest.count({ where: { userId } }),
    prisma.apiRequest.count({ where: { userId, startedAt: { gte: todayStart } } }),
    prisma.apiRequest.count({ where: { userId, status: "SUCCESS" } }),
    prisma.apiRequest.findMany({
      where: { userId },
      select: {
        requestId: true,
        startedAt: true,
        latencyMs: true,
        status: true,
        totalTokens: true,
        modelId: true,
        provider: { select: { displayName: true } },
        sandboxKey: { select: { keyPrefix: true, name: true } },
        wasSimulated: true,
      },
      orderBy: { startedAt: "desc" },
      take: 20,
    }),
    prisma.apiRequest.aggregate({
      where: { userId, latencyMs: { not: null } },
      _avg: { latencyMs: true },
      _min: { latencyMs: true },
      _max: { latencyMs: true },
    }),
  ]);

  const totalTokens = await prisma.apiRequest.aggregate({
    where: { userId },
    _sum: { totalTokens: true },
  });

  const errorRate = totalRequests > 0
    ? ((totalRequests - successRequests) / totalRequests) * 100
    : 0;

  return NextResponse.json({
    stats: {
      activeKeys,
      expiredKeys,
      totalRequests,
      todayRequests,
      totalTokens: totalTokens._sum.totalTokens ?? 0,
      errorRate: Math.round(errorRate * 10) / 10,
      avgLatencyMs: Math.round(latencyData._avg.latencyMs ?? 0),
      minLatencyMs: latencyData._min.latencyMs ?? 0,
      maxLatencyMs: latencyData._max.latencyMs ?? 0,
    },
    recentRequests,
  });
}
