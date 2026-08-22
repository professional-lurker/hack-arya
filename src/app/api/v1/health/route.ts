/**
 * Health API
 * GET /api/v1/health - Provider health status
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getProvider, getAllProviders } from "@/lib/providers";

export async function GET() {
  // Get the latest health record per provider
  const providers = await prisma.provider.findMany({
    where: { isEnabled: true },
    include: {
      systemHealth: {
        orderBy: { checkedAt: "desc" },
        take: 1,
      },
    },
  });

  const health = providers.map((p) => ({
    id: p.id,
    name: p.name,
    displayName: p.displayName,
    status: p.healthStatus,
    lastChecked: p.lastHealthCheck,
    latencyMs: p.systemHealth[0]?.latencyMs ?? null,
  }));

  const allHealthy = health.every((h) => h.status === "OPERATIONAL" || h.status === "UNKNOWN");

  return NextResponse.json({
    status: allHealthy ? "healthy" : "degraded",
    providers: health,
    timestamp: new Date().toISOString(),
  });
}

/**
 * POST /api/v1/health/check - Trigger manual health check (admin only)
 */
export async function POST() {
  const providers = await prisma.provider.findMany({ where: { isEnabled: true } });

  const results = await Promise.allSettled(
    providers.map(async (dbProvider) => {
      const adapter = getProvider(dbProvider.name);
      if (!adapter) {
        return { name: dbProvider.name, healthy: false, error: "No adapter registered" };
      }

      const result = await adapter.healthCheck();
      const status = result.healthy ? "OPERATIONAL" : "OUTAGE";

      await prisma.provider.update({
        where: { id: dbProvider.id },
        data: { healthStatus: status, lastHealthCheck: new Date(), isHealthy: result.healthy },
      });

      await prisma.systemHealth.create({
        data: {
          providerId: dbProvider.id,
          status,
          latencyMs: result.latencyMs,
          errorMessage: result.error,
        },
      });

      return { name: dbProvider.name, healthy: result.healthy, latencyMs: result.latencyMs };
    })
  );

  return NextResponse.json({ results: results.map((r) => (r.status === "fulfilled" ? r.value : { error: "check failed" })) });
}
