/**
 * OpenAI provider adapter.
 * Uses the openai SDK.
 * Requires OPENAI_API_KEY in environment.
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

const OPENAI_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 5.0, output: 15.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4-turbo": { input: 10.0, output: 30.0 },
  "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
  default: { input: 1.0, output: 3.0 },
};

const OPENAI_MODELS: ModelInfo[] = [
  {
    id: "gpt-4o",
    displayName: "GPT-4o",
    description: "OpenAI's most capable multimodal model",
    maxInputTokens: 128000,
    maxOutputTokens: 4096,
    supportsStreaming: true,
    supportsVision: true,
  },
  {
    id: "gpt-4o-mini",
    displayName: "GPT-4o Mini",
    description: "Affordable and intelligent model",
    maxInputTokens: 128000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    supportsVision: true,
  },
  {
    id: "gpt-3.5-turbo",
    displayName: "GPT-3.5 Turbo",
    description: "Fast and cost-effective",
    maxInputTokens: 16385,
    maxOutputTokens: 4096,
    supportsStreaming: true,
    supportsVision: false,
  },
];

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  readonly displayName = "OpenAI";

  private get apiKey(): string {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY is not configured");
    return key;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const OpenAI = (await import("openai")).default;
      const client = new OpenAI({ apiKey: this.apiKey });
      await client.models.list();
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
    return OPENAI_MODELS;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const startedAt = Date.now();
    try {
      const OpenAI = (await import("openai")).default;
      const client = new OpenAI({ apiKey: this.apiKey });

      const messages: { role: "system" | "user" | "assistant"; content: string }[] = [];
      if (request.systemPrompt) {
        messages.push({ role: "system", content: request.systemPrompt });
      }
      messages.push(
        ...request.messages
          .filter((m) => m.role !== "system")
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
      );

      const completion = await client.chat.completions.create({
        model: request.model,
        messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        stream: false,
      });

      const choice = completion.choices[0];
      const usage: TokenUsage = {
        inputTokens: completion.usage?.prompt_tokens ?? 0,
        outputTokens: completion.usage?.completion_tokens ?? 0,
        totalTokens: completion.usage?.total_tokens ?? 0,
      };

      return {
        id: completion.id,
        model: completion.model,
        content: choice.message.content ?? "",
        usage,
        finishReason: choice.finish_reason ?? "stop",
        latencyMs: Date.now() - startedAt,
      };
    } catch (err) {
      throw normalizeProviderError(err, this.displayName);
    }
  }

  estimateCost(usage: TokenUsage, modelId: string): number {
    const pricing = OPENAI_PRICING[modelId] ?? OPENAI_PRICING.default;
    return (
      (usage.inputTokens / 1_000_000) * pricing.input +
      (usage.outputTokens / 1_000_000) * pricing.output
    );
  }
}
