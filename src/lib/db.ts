import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
// @ts-ignore
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { SCHEMA_DDL } from "./schema-ddl";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const rawUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  const dbPath = rawUrl.startsWith("file:") ? rawUrl.slice(5) : rawUrl;
  const absPath = path.isAbsolute(dbPath)
    ? dbPath
    : path.join(/* turbopackIgnore: true */ process.cwd(), dbPath);

  // Ensure directory exists
  const dir = path.dirname(absPath);
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      // ignore
    }
  }

  // Ensure SQLite schema exists
  try {
    const rawDb = new Database(absPath);
    const tableExists = rawDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
    if (!tableExists) {
      rawDb.exec(SCHEMA_DDL);
      rawDb.prepare(`
        INSERT OR IGNORE INTO users (id, email, name, role, isActive, updatedAt)
        VALUES ('admin-default-user', 'admin@aisandbox.dev', 'Admin', 'SUPER_ADMIN', 1, CURRENT_TIMESTAMP)
      `).run();
      rawDb.prepare(`
        INSERT OR IGNORE INTO providers (id, name, displayName, description, isEnabled, isHealthy, healthStatus, updatedAt)
        VALUES ('prov-mock-01', 'mock', 'Mock Provider (Demo)', 'Simulated AI responses for testing', 1, 1, 'OPERATIONAL', CURRENT_TIMESTAMP)
      `).run();
      rawDb.prepare(`
        INSERT OR IGNORE INTO provider_models (id, providerId, modelId, displayName, isEnabled, updatedAt)
        VALUES ('model-mock-01', 'prov-mock-01', 'mock-chat-v1', 'Mock Chat v1', 1, CURRENT_TIMESTAMP)
      `).run();
    }
    rawDb.close();
  } catch (e) {
    console.error("Auto-init SQLite error:", e);
  }

  const adapter = new PrismaBetterSqlite3({ url: `file:${absPath}` });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;


