/**
 * OpenWeather provider adapter for AI Sandbox.
 * Provides live real-time weather intelligence via OpenAI-compatible completions.
 * Requires OPENWEATHER_API_KEY in environment.
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

const OPENWEATHER_MODELS: ModelInfo[] = [
  {
    id: "openweather-current",
    displayName: "OpenWeather Current",
    description: "Real-time weather data by city or coordinates",
    maxInputTokens: 8192,
    maxOutputTokens: 4096,
    supportsStreaming: false,
    supportsVision: false,
  },
  {
    id: "openweather-forecast",
    displayName: "OpenWeather 5-Day Forecast",
    description: "5-day / 3-hour weather forecast",
    maxInputTokens: 8192,
    maxOutputTokens: 8192,
    supportsStreaming: false,
    supportsVision: false,
  },
  {
    id: "openweather-air-pollution",
    displayName: "OpenWeather Air Quality",
    description: "Air pollution & AQI index metrics",
    maxInputTokens: 8192,
    maxOutputTokens: 4096,
    supportsStreaming: false,
    supportsVision: false,
  },
];

interface ForecastEntry {
  dt_txt?: string;
  dt?: number;
  main?: { temp?: number; humidity?: number };
  weather?: Array<{ description?: string }>;
}

// Helper to extract city / location from message
function extractLocation(input: string): string {
  const clean = input.trim();
  // If JSON format
  try {
    const parsed = JSON.parse(clean);
    if (parsed.city || parsed.location || parsed.q) {
      return parsed.city || parsed.location || parsed.q;
    }
  } catch {
    // not JSON
  }

  // Regex patterns for natural language
  const patterns = [
    /(?:weather in|weather for|weather at|temperature in|temperature of|forecast for|forecast in)\s+([A-Za-z\s,]+?)(?:\?|\.|\!|$|\s+today|\s+tomorrow|\s+now)/i,
    /in\s+([A-Za-z\s,]+?)(?:\?|\.|\!|$)/i,
    /for\s+([A-Za-z\s,]+?)(?:\?|\.|\!|$)/i,
  ];

  for (const pattern of patterns) {
    const match = clean.match(pattern);
    if (match && match[1]) {
      const loc = match[1].trim();
      if (loc.length > 1 && !["the", "a", "my", "this"].includes(loc.toLowerCase())) {
        return loc;
      }
    }
  }

  // If short text, treat whole string as location
  if (clean.length <= 40 && !clean.includes("\n")) {
    return clean.replace(/weather|temperature|forecast|today|now|\?/gi, "").trim() || "London";
  }

  return "London";
}

export class OpenWeatherProvider implements AIProvider {
  readonly name = "openweather";
  readonly displayName = "OpenWeather";

  private get apiKey(): string {
    const key = process.env.OPENWEATHER_API_KEY;
    if (!key) throw new Error("OPENWEATHER_API_KEY is not configured");
    return key;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=London&appid=${encodeURIComponent(this.apiKey)}`
      );
      if (!res.ok) {
        return {
          healthy: false,
          latencyMs: Date.now() - start,
          error: `OpenWeather API error (Status ${res.status})`,
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
    return OPENWEATHER_MODELS;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const startedAt = Date.now();
    try {
      const lastUserMsg = [...request.messages].reverse().find((m) => m.role === "user")?.content || "London";
      const location = extractLocation(lastUserMsg);

      let content = "";
      const model = request.model || "openweather-current";

      if (model.includes("forecast")) {
        // 5-day forecast
        const res = await fetch(
          `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(location)}&appid=${encodeURIComponent(this.apiKey)}&units=metric`
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || `Could not find forecast for "${location}"`);
        }
        const data = await res.json();
        const city = data.city?.name || location;
        const country = data.city?.country || "";

        const forecasts = ((data.list || []) as ForecastEntry[]).slice(0, 8).map((f) => {
          const dt = f.dt_txt || new Date((f.dt ?? 0) * 1000).toISOString();
          const temp = f.main?.temp;
          const desc = f.weather?.[0]?.description || "clear";
          const humidity = f.main?.humidity;
          return `• **${dt}**: ${temp}°C, ${desc}, ${humidity}% humidity`;
        });

        content = `### 🌤️ 5-Day Weather Forecast for **${city}, ${country}**\n\n` +
          `Here is the upcoming forecast:\n\n` +
          forecasts.join("\n") +
          `\n\n*Source: OpenWeather API via AI Sandbox Gateway*`;
      } else {
        // Current Weather
        const res = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${encodeURIComponent(this.apiKey)}&units=metric`
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || `Could not find weather data for "${location}"`);
        }
        const data = await res.json();
        const cityName = data.name || location;
        const country = data.sys?.country || "";
        const tempC = data.main?.temp;
        const tempF = tempC !== undefined ? Math.round((tempC * 9) / 5 + 32) : "N/A";
        const feelsLikeC = data.main?.feels_like;
        const weatherDesc = data.weather?.[0]?.description || "Clear";
        const humidity = data.main?.humidity;
        const windSpeed = data.wind?.speed;
        const pressure = data.main?.pressure;
        const visibility = data.visibility ? `${(data.visibility / 1000).toFixed(1)} km` : "N/A";

        content = `### 🌤️ Weather Report for **${cityName}, ${country}**\n\n` +
          `- **Temperature:** **${tempC}°C** (${tempF}°F) *(Feels like ${feelsLikeC}°C)*\n` +
          `- **Conditions:** **${weatherDesc.charAt(0).toUpperCase() + weatherDesc.slice(1)}**\n` +
          `- **Humidity:** ${humidity}%\n` +
          `- **Wind Speed:** ${windSpeed} m/s\n` +
          `- **Pressure:** ${pressure} hPa\n` +
          `- **Visibility:** ${visibility}\n\n` +
          `\`\`\`json\n` +
          JSON.stringify(
            {
              location: `${cityName}, ${country}`,
              coordinates: data.coord,
              temperature: { celsius: tempC, fahrenheit: tempF, feels_like_c: feelsLikeC },
              conditions: weatherDesc,
              humidity: `${humidity}%`,
              wind: `${windSpeed} m/s`,
              pressure: `${pressure} hPa`,
            },
            null,
            2
          ) +
          `\n\`\`\``;
      }

      // Compute pseudo token usage for quota tracking
      const inputTokens = Math.ceil(lastUserMsg.length / 4);
      const outputTokens = Math.ceil(content.length / 4);
      const usage: TokenUsage = {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      };

      return {
        id: `openweather_${Date.now()}`,
        model,
        content,
        usage,
        finishReason: "STOP",
        latencyMs: Date.now() - startedAt,
      };
    } catch (err) {
      console.error("[OpenWeather] Error:", err instanceof Error ? err.message : err);
      throw normalizeProviderError(err, this.displayName);
    }
  }

  estimateCost(usage: TokenUsage, _modelId: string): number {
    // OpenWeather calls: flat nominal rate (~$0.0001 per call)
    return 0.0001;
  }
}
