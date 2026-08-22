/**
 * Provider registry — maps provider names to adapter instances.
 * Add new providers here without touching gateway code.
 */

import { AIProvider } from "./base";
import { MockProvider } from "./mock";
import { GeminiProvider } from "./gemini";
import { OpenAIProvider } from "./openai";
import { OpenWeatherProvider } from "./openweather";

const registry = new Map<string, AIProvider>();

// Always register mock
registry.set("mock", new MockProvider());

// Register real providers if keys are configured
if (process.env.GEMINI_API_KEY) {
  registry.set("gemini", new GeminiProvider());
}
if (process.env.OPENAI_API_KEY) {
  registry.set("openai", new OpenAIProvider());
}
if (process.env.OPENWEATHER_API_KEY) {
  registry.set("openweather", new OpenWeatherProvider());
}

export function getProvider(name: string): AIProvider | null {
  return registry.get(name) ?? null;
}

export function getAllProviders(): AIProvider[] {
  return Array.from(registry.values());
}

export function getProviderNames(): string[] {
  return Array.from(registry.keys());
}

export { MockProvider, GeminiProvider, OpenAIProvider, OpenWeatherProvider };
