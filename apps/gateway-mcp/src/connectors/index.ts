// ---------------------------------------------------------------------------
// Connector registration — registers all built-in connectors
// ---------------------------------------------------------------------------

export { registerEchoConnector } from "./echo.js";
export { registerWeatherConnector } from "./weather.js";

import { registerEchoConnector } from "./echo.js";
import { registerWeatherConnector } from "./weather.js";

export function registerBuiltinConnectors(): void {
  registerEchoConnector();
  registerWeatherConnector();
}
