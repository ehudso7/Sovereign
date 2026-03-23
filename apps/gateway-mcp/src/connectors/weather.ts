// ---------------------------------------------------------------------------
// Weather connector — credentialed proof connector (dev-safe simulation)
// ---------------------------------------------------------------------------

import { registerTool } from "../registry.js";
import type { ToolHandler } from "../registry.js";

const getWeatherHandler: ToolHandler = async (args, ctx) => {
  // Validate credentials
  if (!ctx.credentials || !ctx.credentials.apiKey) {
    return {
      output: {},
      error: { code: "AUTH_REQUIRED", message: "Weather connector requires an API key" },
      latencyMs: 1,
    };
  }

  const location = (args.location as string) ?? "Unknown";
  const apiKey = ctx.credentials.apiKey as string;

  // Dev-safe simulation — deterministic based on location hash
  const hash = location.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const temp = 15 + (hash % 25); // 15-39°C
  const conditions = ["sunny", "cloudy", "rainy", "partly cloudy", "overcast"];
  const condition = conditions[hash % conditions.length]!;
  const humidity = 30 + (hash % 50);

  return {
    output: {
      location,
      temperature_c: temp,
      condition,
      humidity_pct: humidity,
      wind_kph: 5 + (hash % 30),
      provider: "weather-dev",
      api_key_prefix: apiKey.slice(0, 4) + "...",
    },
    latencyMs: 50,
  };
};

const getForecastHandler: ToolHandler = async (args, ctx) => {
  if (!ctx.credentials || !ctx.credentials.apiKey) {
    return {
      output: {},
      error: { code: "AUTH_REQUIRED", message: "Weather connector requires an API key" },
      latencyMs: 1,
    };
  }

  const location = (args.location as string) ?? "Unknown";
  const days = Math.min((args.days as number) ?? 3, 7);
  const hash = location.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);

  const forecast = Array.from({ length: days }, (_, i) => {
    const dayHash = hash + i * 17;
    const conditions = ["sunny", "cloudy", "rainy", "partly cloudy"];
    return {
      day: i + 1,
      high_c: 18 + (dayHash % 20),
      low_c: 5 + (dayHash % 15),
      condition: conditions[dayHash % conditions.length],
    };
  });

  return {
    output: { location, forecast, provider: "weather-dev" },
    latencyMs: 75,
  };
};

export function registerWeatherConnector(): void {
  registerTool(
    {
      name: "get_weather",
      description: "Get current weather conditions for a location.",
      parameters: [
        { name: "location", type: "string", description: "City or location name", required: true },
      ],
      connectorSlug: "weather",
    },
    getWeatherHandler,
  );

  registerTool(
    {
      name: "get_forecast",
      description: "Get weather forecast for a location.",
      parameters: [
        { name: "location", type: "string", description: "City or location name", required: true },
        { name: "days", type: "number", description: "Number of forecast days (1-7)", required: false },
      ],
      connectorSlug: "weather",
    },
    getForecastHandler,
  );
}
