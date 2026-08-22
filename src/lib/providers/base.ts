/**
 * Provider abstraction layer.
 * All AI providers must implement the AIProvider interface.
 * The gateway layer never calls provider SDKs directly.
 */

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  systemPrompt?: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ChatResponse {
  id: string;
  model: string;
  content: string;
  usage: TokenUsage;
  finishReason: string;
  latencyMs: number;
}

export interface ProviderError {
  type:
    | "auth_error"
    | "rate_limited"
    | "quota_exceeded"
    | "model_not_found"
    | "invalid_request"
    | "provider_unavailable"
    | "timeout"
    | "unknown";
  message: string;
  statusCode: number;
  raw?: unknown;
}

export interface ModelInfo {
  id: string;
  displayName: string;
  description?: string;
  maxInputTokens?: number;
  maxOutputTokens?: number;
  supportsStreaming: boolean;
  supportsVision: boolean;
}

export interface HealthCheckResult {
  healthy: boolean;
  latencyMs?: number;
  error?: string;
}

/**
 * Core provider interface — every AI provider adapter must implement this.
 */
export interface AIProvider {
  readonly name: string;
  readonly displayName: string;

  /** Verify that the provider credentials are working */
  healthCheck(): Promise<HealthCheckResult>;

  /** List available models */
  listModels(): Promise<ModelInfo[]>;

  /** Send a non-streaming chat request */
  chat(request: ChatRequest): Promise<ChatResponse>;

  /** Estimate cost in USD for a given token usage */
  estimateCost(usage: TokenUsage, modelId: string): number;
}

/**
 * Normalize a raw provider error into a consistent ProviderError shape.
 */
export function normalizeProviderError(
  err: unknown,
  providerName: string
): ProviderError {
  if (err instanceof Error) {
    const message = err.message.toLowerCase();
    
    if (message.includes("rate limit") || message.includes("429")) {
      return { type: "rate_limited", message: `${providerName} rate limit exceeded`, statusCode: 429, raw: err };
    }
    if (message.includes("auth") || message.includes("401") || message.includes("403")) {
      return { type: "auth_error", message: `${providerName} authentication failed`, statusCode: 401, raw: err };
    }
    if (message.includes("quota") || message.includes("billing")) {
      return { type: "quota_exceeded", message: `${providerName} quota exceeded`, statusCode: 402, raw: err };
    }
    if (message.includes("not found") || message.includes("model")) {
      return { type: "model_not_found", message: `Model not found on ${providerName}`, statusCode: 404, raw: err };
    }
    if (message.includes("timeout")) {
      return { type: "timeout", message: `Request to ${providerName} timed out`, statusCode: 504, raw: err };
    }
  }
  return {
    type: "unknown",
    message: `Unexpected error from ${providerName}`,
    statusCode: 500,
    raw: err,
  };
}
