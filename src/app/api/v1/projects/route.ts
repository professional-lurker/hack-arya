/**
 * Projects API
 * GET  /api/v1/projects  - List user projects
 * POST /api/v1/projects  - Create project
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projects = await prisma.project.findMany({
    where: { userId: session.user.id, deletedAt: null },
    include: {
      _count: { select: { sandboxKeys: true, testSessions: true } },
      testSessions: {
        where: { deletedAt: null },
        include: {
          _count: { select: { sandboxKeys: true, apiRequests: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const project = await prisma.project.create({
    data: { ...parsed.data, userId: session.user.id },
  });

  return NextResponse.json({ project }, { status: 201 });
}
