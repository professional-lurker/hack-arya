/**
 * Providers API
 * GET /api/v1/providers - List enabled providers and their models
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const providers = await prisma.provider.findMany({
    where: { isEnabled: true },
    include: {
      models: { where: { isEnabled: true }, orderBy: { displayName: "asc" } },
    },
    orderBy: { displayName: "asc" },
  });

  // Strip sensitive fields
  const safeProviders = providers.map(
    ({ currentDailySpend: _, currentHourlySpend: __, ...p }) => p
  );

  return NextResponse.json({ providers: safeProviders });
}
