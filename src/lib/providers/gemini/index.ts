/**
 * Google Gemini provider adapter.
 * Uses the REST API directly for maximum compatibility with all key types.
 * Requires GEMINI_API_KEY in environment.
 */

import {
  AIProvider,
  ChatRequest,
  ChatResponse,
  HealthCheckResult,
  ModelInfo,
  TokenUsage,
  normalizeProviderError,
} from "../base";

// Gemini pricing (USD per 1M tokens)
const GEMINI_PRICING: Record<string, { input: number; output: number }> = {
  "gemini-3.5-flash": { input: 0.075, output: 0.3 },
  "gemini-3.6-flash": { input: 0.075, output: 0.3 },
  "gemini-3.7-flash": { input: 0.1, output: 0.4 },
  "gemini-flash-latest": { input: 0.075, output: 0.3 },
  "gemini-pro-latest": { input: 1.25, output: 5.0 },
  default: { input: 0.075, output: 0.3 },
};

const GEMINI_MODELS: ModelInfo[] = [
  {
    id: "gemini-3.5-flash",
    displayName: "Gemini 3.5 Flash",
    description: "Fast, balanced multimodal model",
    maxInputTokens: 1048576,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: true,
  },
  {
    id: "gemini-3.6-flash",
    displayName: "Gemini 3.6 Flash",
    description: "Fast and intelligent multimodal model",
    maxInputTokens: 1048576,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: true,
  },
  {
    id: "gemini-3.7-flash",
    displayName: "Gemini 3.7 Flash",
    description: "Latest Gemini Flash with hybrid reasoning",
    maxInputTokens: 1048576,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: true,
  },
  {
    id: "gemini-flash-latest",
    displayName: "Gemini Flash (Latest)",
    description: "Always points to latest stable Flash",
    maxInputTokens: 1048576,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: true,
  },
  {
    id: "gemini-pro-latest",
    displayName: "Gemini Pro (Latest)",
    description: "Latest Pro model for complex reasoning",
    maxInputTokens: 2097152,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: true,
  },
];

// Normalize requested model to an active Google API model
function resolveModelName(requested: string): string {
  if (requested.includes("3.6")) return "gemini-3.6-flash";
  if (requested.includes("3.5")) return "gemini-3.5-flash";
  if (requested.includes("pro")) return "gemini-pro-latest";
  if (requested === "gemini-flash-latest") return requested;
  // Default to 3.7-flash
  return "gemini-3.7-flash";
}

export class GeminiProvider implements AIProvider {
  readonly name = "gemini";
  readonly displayName = "Google Gemini";

  private get apiKey(): string {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is not configured");
    return key;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const model = "gemini-3.6-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "ping" }] }],
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return {
          healthy: false,
          latencyMs: Date.now() - start,
          error: `Google API ${res.status}: ${errText}`,
        };
      }

      return { healthy: true, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    return GEMINI_MODELS;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const startedAt = Date.now();
    const primaryModel = resolveModelName(request.model);
    const modelsToTry = Array.from(new Set([primaryModel, "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash"]));

    // Build conversation contents in Google format
    const contents = request.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const body: Record<string, unknown> = { contents };

    if (request.systemPrompt) {
      body.systemInstruction = {
        parts: [{ text: request.systemPrompt }],
      };
    }

    if (request.temperature !== undefined || request.maxTokens !== undefined) {
      body.generationConfig = {
        ...(request.temperature !== undefined && { temperature: request.temperature }),
        ...(request.maxTokens !== undefined && { maxOutputTokens: request.maxTokens }),
      };
    }

    let lastError: Error | null = null;

    for (const model of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const msg = errData?.error?.message || `Google API error (Status ${res.status})`;
          // If 503 (high demand) or 429, try next model
          if (res.status === 503 || res.status === 429 || res.status === 404) {
            console.warn(`[Gemini] ${model} returned ${res.status}, falling back to next model...`);
            lastError = new Error(msg);
            continue;
          }
          throw new Error(msg);
        }

        const data = await res.json();
        const candidate = data.candidates?.[0];
        const part = candidate?.content?.parts?.[0];
        const content = part?.text || "";
        const usageMeta = data.usageMetadata;

        const usage: TokenUsage = {
          inputTokens: usageMeta?.promptTokenCount ?? 0,
          outputTokens: usageMeta?.candidatesTokenCount ?? 0,
          totalTokens: usageMeta?.totalTokenCount ?? 0,
        };

        return {
          id: `gemini_${Date.now()}`,
          model,
          content,
          usage,
          finishReason: candidate?.finishReason ?? "STOP",
          latencyMs: Date.now() - startedAt,
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (model === modelsToTry[modelsToTry.length - 1]) {
          break;
        }
      }
    }

    console.error("[Gemini] All models failed:", lastError?.message);
    throw normalizeProviderError(lastError, this.displayName);
  }

  estimateCost(usage: TokenUsage, modelId: string): number {
    const pricing = GEMINI_PRICING[modelId] ?? GEMINI_PRICING.default;
    return (
      (usage.inputTokens / 1_000_000) * pricing.input +
      (usage.outputTokens / 1_000_000) * pricing.output
    );
  }
}
