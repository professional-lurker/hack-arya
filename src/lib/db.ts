import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";
import fs from "fs";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const rawUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  const dbPath = rawUrl.startsWith("file:") ? rawUrl.slice(5) : rawUrl;
  const absPath = path.isAbsolute(dbPath)
    ? dbPath
    : path.join(/* turbopackIgnore: true */ process.cwd(), dbPath);

  // If deployed to serverless environment with /tmp path, copy seeded database if missing
  if (absPath.startsWith("/tmp") || absPath.includes("/tmp/")) {
    if (!fs.existsSync(absPath)) {
      const source = path.join(process.cwd(), "prisma", "dev.db");
      if (fs.existsSync(source)) {
        try {
          fs.copyFileSync(source, absPath);
        } catch {
          // ignore error
        }
      }
    }
  }

  const adapter = new PrismaBetterSqlite3({ url: `file:${absPath}` });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

