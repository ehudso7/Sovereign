// ---------------------------------------------------------------------------
// Connector and skill catalog definitions
// ---------------------------------------------------------------------------

export interface CatalogConnector {
  slug: string;
  name: string;
  description: string;
  category: string;
  trustTier: string;
  authMode: string;
  tools: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>;
  scopes: Array<{
    id: string;
    name: string;
    description: string;
  }>;
}

export interface CatalogSkill {
  slug: string;
  name: string;
  description: string;
  trustTier: string;
  connectorSlugs: string[];
}

export const BUILTIN_CONNECTORS: CatalogConnector[] = [
  {
    slug: "echo",
    name: "Echo & Utilities",
    description: "A simple utility connector for testing. Echoes messages and provides the current time. No authentication required.",
    category: "utility",
    trustTier: "verified",
    authMode: "none",
    tools: [
      {
        name: "echo",
        description: "Echoes back the input message along with metadata (reversed text, length).",
        parameters: {
          type: "object",
          properties: {
            message: { type: "string", description: "Message to echo" },
          },
          required: ["message"],
        },
      },
      {
        name: "current_time",
        description: "Returns the current UTC time and unix timestamp.",
        parameters: { type: "object", properties: {}, required: [] },
      },
    ],
    scopes: [
      { id: "echo:read", name: "Echo Read", description: "Echo messages and read time" },
    ],
  },
  {
    slug: "weather",
    name: "Weather Service",
    description: "Get current weather and forecasts for any location. Requires an API key for authentication.",
    category: "data",
    trustTier: "verified",
    authMode: "api_key",
    tools: [
      {
        name: "get_weather",
        description: "Get current weather conditions for a location.",
        parameters: {
          type: "object",
          properties: {
            location: { type: "string", description: "City or location name" },
          },
          required: ["location"],
        },
      },
      {
        name: "get_forecast",
        description: "Get weather forecast for a location.",
        parameters: {
          type: "object",
          properties: {
            location: { type: "string", description: "City or location name" },
            days: { type: "number", description: "Number of forecast days (1-7)" },
          },
          required: ["location"],
        },
      },
    ],
    scopes: [
      { id: "weather:current", name: "Current Weather", description: "Read current weather data" },
      { id: "weather:forecast", name: "Forecast", description: "Read weather forecasts" },
    ],
  },
];

export const BUILTIN_SKILLS: CatalogSkill[] = [
  {
    slug: "research-assistant",
    name: "Research Assistant",
    description: "A skill that packages echo and weather tools for research tasks. Demonstrates how skills bundle connector capabilities.",
    trustTier: "verified",
    connectorSlugs: ["echo", "weather"],
  },
];
