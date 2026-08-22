/**
 * Database seed file — creates demo data for hackathon presentation.
 * Run with: npx prisma db seed
 *
 * Creates:
 * - Admin user
 * - Demo user with projects, sessions, and keys
 * - Provider configurations (mock + Gemini + OpenAI)
 * - Sample request history
 */

import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";
import { hashPassword, hashSandboxKey, generateSandboxKey, getKeyPrefix, encryptCredential } from "../src/lib/crypto";

// Load env
import { config } from "dotenv";
config({ path: ".env.local" });

const rawUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const dbPath = rawUrl.startsWith("file:") ? rawUrl.slice(5) : rawUrl;
const dbAbsPath = path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath);
const adapter = new PrismaBetterSqlite3({ url: `file:${dbAbsPath}` });
const prisma = new PrismaClient({ adapter });





async function main() {
  console.log("🌱 Starting database seed...");

  // helper: upsert a providerModel by (providerId, modelId)
  const upsertModel = (data: {
    providerId: string; modelId: string; displayName: string;
    description?: string; isEnabled?: boolean; maxInputTokens?: number;
    maxOutputTokens?: number; supportsStreaming?: boolean; supportsVision?: boolean; tier?: string;
  }) =>
    prisma.providerModel.upsert({
      where: { providerId_modelId: { providerId: data.providerId, modelId: data.modelId } },
      update: {},
      create: data,
    });

  // ── 1. Create providers ─────────────────────────────────────────────────
  console.log("Creating providers...");

  const mockProvider = await prisma.provider.upsert({
    where: { name: "mock" },
    update: {},
    create: {
      name: "mock",
      displayName: "Mock Provider (Demo)",
      description: "Simulated AI responses for testing — no real API credits consumed",
      isEnabled: true,
      isHealthy: true,
      healthStatus: "OPERATIONAL",
      lastHealthCheck: new Date(),
      defaultMaxRequests: 100,
      defaultMaxTokens: 100000,
      defaultMaxLifetime: 86400,
    },
  });

  await upsertModel({ providerId: mockProvider.id, modelId: "mock-fast", displayName: "Mock Fast (Instant)", description: "~100ms latency", isEnabled: true, maxInputTokens: 32000, maxOutputTokens: 4096, supportsStreaming: true });
  await upsertModel({ providerId: mockProvider.id, modelId: "mock-standard", displayName: "Mock Standard (~800ms)", description: "~800ms latency", isEnabled: true, maxInputTokens: 128000, maxOutputTokens: 8192, supportsStreaming: true });
  await upsertModel({ providerId: mockProvider.id, modelId: "mock-slow", displayName: "Mock Slow (~2s)", description: "~2s latency", isEnabled: true, maxInputTokens: 200000, maxOutputTokens: 16384, supportsStreaming: true });

  const geminiProvider = await prisma.provider.upsert({
    where: { name: "gemini" },
    update: {},
    create: {
      name: "gemini",
      displayName: "Google Gemini",
      description: "Google's Gemini family of models",
      isEnabled: !!process.env.GEMINI_API_KEY,
      isHealthy: true,
      healthStatus: "UNKNOWN",
      defaultMaxRequests: 50,
      defaultMaxTokens: 50000,
      defaultMaxLifetime: 3600,
      maxDailyBudgetUsd: 5.0,
      maxHourlyBudgetUsd: 1.0,
    },
  });

  await upsertModel({ providerId: geminiProvider.id, modelId: "gemini-2.0-flash", displayName: "Gemini 2.0 Flash", description: "Latest and fastest Gemini model", isEnabled: true, maxInputTokens: 1048576, maxOutputTokens: 8192, supportsStreaming: true, supportsVision: true });
  await upsertModel({ providerId: geminiProvider.id, modelId: "gemini-2.0-flash-lite", displayName: "Gemini 2.0 Flash-Lite", description: "Most cost-efficient Gemini model", isEnabled: true, maxInputTokens: 1048576, maxOutputTokens: 8192, supportsStreaming: true });
  await upsertModel({ providerId: geminiProvider.id, modelId: "gemini-1.5-flash", displayName: "Gemini 1.5 Flash", description: "Versatile and cost-effective", isEnabled: true, maxInputTokens: 1048576, maxOutputTokens: 8192, supportsStreaming: true, supportsVision: true });
  await upsertModel({ providerId: geminiProvider.id, modelId: "gemini-1.5-pro", displayName: "Gemini 1.5 Pro", description: "Most capable Gemini 1.5 model", isEnabled: true, maxInputTokens: 2097152, maxOutputTokens: 8192, supportsStreaming: true, supportsVision: true, tier: "premium" });

  const openaiProvider = await prisma.provider.upsert({
    where: { name: "openai" },
    update: {},
    create: {
      name: "openai",
      displayName: "OpenAI",
      description: "OpenAI GPT models",
      isEnabled: !!process.env.OPENAI_API_KEY,
      isHealthy: true,
      healthStatus: "UNKNOWN",
      defaultMaxRequests: 25,
      defaultMaxTokens: 30000,
      defaultMaxLifetime: 3600,
      maxDailyBudgetUsd: 5.0,
      maxHourlyBudgetUsd: 1.0,
    },
  });

  await upsertModel({ providerId: openaiProvider.id, modelId: "gpt-4o-mini", displayName: "GPT-4o Mini", description: "Affordable and intelligent", isEnabled: true, maxInputTokens: 128000, maxOutputTokens: 16384, supportsStreaming: true, supportsVision: true });
  await upsertModel({ providerId: openaiProvider.id, modelId: "gpt-4o", displayName: "GPT-4o", description: "OpenAI flagship model", isEnabled: true, maxInputTokens: 128000, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: true, tier: "premium" });

  const openweatherProvider = await prisma.provider.upsert({
    where: { name: "openweather" },
    update: {},
    create: {
      name: "openweather",
      displayName: "OpenWeather",
      description: "Live real-time weather forecasts and conditions",
      isEnabled: !!process.env.OPENWEATHER_API_KEY,
      isHealthy: true,
      healthStatus: "OPERATIONAL",
      defaultMaxRequests: 100,
      defaultMaxTokens: 50000,
      defaultMaxLifetime: 86400,
      maxDailyBudgetUsd: 5.0,
      maxHourlyBudgetUsd: 1.0,
    },
  });

  await upsertModel({ providerId: openweatherProvider.id, modelId: "openweather-current", displayName: "OpenWeather Current", description: "Real-time weather data by city", isEnabled: true, maxInputTokens: 8192, maxOutputTokens: 4096, supportsStreaming: false, supportsVision: false });
  await upsertModel({ providerId: openweatherProvider.id, modelId: "openweather-forecast", displayName: "OpenWeather 5-Day Forecast", description: "5-day 3-hour forecast", isEnabled: true, maxInputTokens: 8192, maxOutputTokens: 8192, supportsStreaming: false, supportsVision: false });
  await upsertModel({ providerId: openweatherProvider.id, modelId: "openweather-air-pollution", displayName: "OpenWeather Air Quality", description: "Air quality index", isEnabled: true, maxInputTokens: 8192, maxOutputTokens: 4096, supportsStreaming: false, supportsVision: false });

  // Store OpenWeather API key if configured
  if (process.env.OPENWEATHER_API_KEY) {
    const existing = await prisma.providerCredential.findFirst({ where: { providerId: openweatherProvider.id } });
    if (!existing) {
      await prisma.providerCredential.create({
        data: {
          providerId: openweatherProvider.id,
          encryptedApiKey: encryptCredential(process.env.OPENWEATHER_API_KEY),
          keyHint: process.env.OPENWEATHER_API_KEY.slice(-4),
        },
      });
    }
  }

  // Store Gemini API key if configured
  if (process.env.GEMINI_API_KEY) {
    const existing = await prisma.providerCredential.findFirst({ where: { providerId: geminiProvider.id } });
    if (!existing) {
      await prisma.providerCredential.create({
        data: {
          providerId: geminiProvider.id,
          encryptedApiKey: encryptCredential(process.env.GEMINI_API_KEY),
          keyHint: process.env.GEMINI_API_KEY.slice(-4),
        },
      });
    }
  }

  // Pricing configs (upsert not supported without unique field — use findFirst+create pattern)
  const upsertPricing = async (providerId: string, modelId: string, inputPricePer1M: number, outputPricePer1M: number) => {
    const existing = await prisma.pricingConfig.findFirst({ where: { providerId, modelId } });
    if (!existing) await prisma.pricingConfig.create({ data: { providerId, modelId, inputPricePer1M, outputPricePer1M } });
  };
  await upsertPricing(geminiProvider.id, "gemini-2.0-flash", 0.1, 0.4);
  await upsertPricing(geminiProvider.id, "gemini-1.5-flash", 0.075, 0.3);
  await upsertPricing(geminiProvider.id, "gemini-1.5-pro", 3.5, 10.5);
  await upsertPricing(openaiProvider.id, "gpt-4o", 5.0, 15.0);
  await upsertPricing(openaiProvider.id, "gpt-4o-mini", 0.15, 0.6);

  // ── 2. Create admin user ────────────────────────────────────────────────
  console.log("Creating admin user...");
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@aisandbox.dev";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "Admin@123!";

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "Admin",
      passwordHash: await hashPassword(adminPassword),
      role: "SUPER_ADMIN",
      emailVerified: new Date(),
    },
  });

  // ── 3. Create demo user ─────────────────────────────────────────────────
  console.log("Creating demo user...");
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@aisandbox.dev" },
    update: {},
    create: {
      email: "demo@aisandbox.dev",
      name: "Alex Developer",
      passwordHash: await hashPassword("Demo@12345!"),
      role: "USER",
      emailVerified: new Date(),
    },
  });

  // ── 4. Create demo projects ─────────────────────────────────────────────
  console.log("Creating demo projects...");

  const chatbotProject = await prisma.project.upsert({
    where: { id: "demo-project-chatbot" },
    update: {},
    create: {
      id: "demo-project-chatbot",
      userId: demoUser.id,
      name: "AI Customer Chatbot",
      description: "Testing whether different AI models work for our customer support chatbot integration",
    },
  });

  const resumeProject = await prisma.project.upsert({
    where: { id: "demo-project-resume" },
    update: {},
    create: {
      id: "demo-project-resume",
      userId: demoUser.id,
      name: "AI Resume Analyzer",
      description: "Building a resume screening tool — testing Gemini for parsing and scoring candidates",
    },
  });

  // ── 5. Create test sessions ─────────────────────────────────────────────
  console.log("Creating test sessions...");

  const session1 = await prisma.testSession.upsert({
    where: { id: "demo-session-1" },
    update: {},
    create: {
      id: "demo-session-1",
      projectId: resumeProject.id,
      name: "Gemini Testing – Day 1",
      description: "Initial Gemini Flash testing for resume parsing",
    },
  });

  const session2 = await prisma.testSession.upsert({
    where: { id: "demo-session-2" },
    update: {},
    create: {
      id: "demo-session-2",
      projectId: chatbotProject.id,
      name: "Mock Provider Baseline",
      description: "Baseline testing with mock provider before switching to real AI",
    },
  });

  // ── 6. Create sandbox keys ─────────────────────────────────────────────
  console.log("Creating sandbox keys...");

  // Active key (for demo)
  const demoActiveKey = generateSandboxKey();
  const demoActiveKeyHash = await hashSandboxKey(demoActiveKey);

  await prisma.sandboxKey.upsert({
    where: { id: "demo-key-active" },
    update: {},
    create: {
      id: "demo-key-active",
      userId: demoUser.id,
      projectId: resumeProject.id,
      testSessionId: session1.id,
      providerId: process.env.GEMINI_API_KEY ? geminiProvider.id : mockProvider.id,
      keyPrefix: getKeyPrefix(demoActiveKey),
      keyHash: demoActiveKeyHash,
      name: "Resume Analyzer – Gemini Test",
      status: "ACTIVE",
      maxRequests: 25,
      maxTokens: 20000,
      maxRatePer60s: 10,
      requestsUsed: 10,
      tokensUsed: 8291,
      expiresAt: new Date(Date.now() + 45 * 60 * 1000), // 45 min remaining
    },
  });

  // Expired key
  const expiredKey = generateSandboxKey();
  const expiredKeyHash = await hashSandboxKey(expiredKey);
  await prisma.sandboxKey.upsert({
    where: { id: "demo-key-expired" },
    update: {},
    create: {
      id: "demo-key-expired",
      userId: demoUser.id,
      projectId: chatbotProject.id,
      testSessionId: session2.id,
      providerId: mockProvider.id,
      keyPrefix: getKeyPrefix(expiredKey),
      keyHash: expiredKeyHash,
      name: "Chatbot Mock Test",
      status: "EXPIRED",
      maxRequests: 50,
      maxTokens: 30000,
      maxRatePer60s: 10,
      requestsUsed: 47,
      tokensUsed: 26410,
      expiresAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // expired 2 hours ago
    },
  });

  // ── 7. Create sample API requests ──────────────────────────────────────
  console.log("Creating sample request history...");

  const activeKey = await prisma.sandboxKey.findUnique({ where: { id: "demo-key-active" } });
  if (activeKey) {
    const statuses = [
      "SUCCESS", "SUCCESS", "SUCCESS", "SUCCESS", "SUCCESS",
      "SUCCESS", "SUCCESS", "SUCCESS", "RATE_LIMITED", "SUCCESS",
    ];
    const models = ["gemini-2.0-flash", "gemini-1.5-flash", "mock-fast", "mock-standard"];

    for (let i = 0; i < 10; i++) {
      const isSuccess = statuses[i] === "SUCCESS";
      const latency = isSuccess ? 500 + Math.random() * 1500 : 50;
      const tokens = isSuccess ? Math.floor(100 + Math.random() * 400) : 0;
      const timestamp = new Date(Date.now() - (10 - i) * 8 * 60 * 1000);

      const reqId = `req_demo_${i.toString().padStart(3, "0")}`;
      const exists = await prisma.apiRequest.findUnique({ where: { requestId: reqId } });
      if (!exists) await prisma.apiRequest.create({
        data: {
          requestId: reqId,
          userId: demoUser.id,
          sandboxKeyId: activeKey.id,
          providerId: activeKey.providerId,
          modelId: models[i % models.length],
          startedAt: timestamp,
          completedAt: new Date(timestamp.getTime() + latency),
          latencyMs: Math.round(latency),
          status: statuses[i],
          httpStatusCode: isSuccess ? 200 : 429,
          inputTokens: isSuccess ? Math.floor(tokens * 0.3) : 0,
          outputTokens: isSuccess ? Math.floor(tokens * 0.7) : 0,
          totalTokens: isSuccess ? tokens : 0,
          wasSimulated: statuses[i] === "RATE_LIMITED",
          simulationType: statuses[i] === "RATE_LIMITED" ? "rate_limit" : null,
          errorMessage: statuses[i] === "RATE_LIMITED" ? "[SIMULATED] Rate limit exceeded" : null,
        },
      });
    }
  }

  console.log(`
✅ Seed complete!

Demo credentials:
  Admin:  ${adminEmail} / ${adminPassword}
  User:   demo@aisandbox.dev / Demo@12345!

Providers enabled:
  Mock:   ✅ (always)
  Gemini: ${process.env.GEMINI_API_KEY ? "✅" : "❌ (set GEMINI_API_KEY)"}
  OpenAI: ${process.env.OPENAI_API_KEY ? "✅" : "❌ (set OPENAI_API_KEY)"}

Active demo key ID: demo-key-active
  `);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
