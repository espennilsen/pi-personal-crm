/**
 * pi-crm-personal — Personal CRM extension for Pi agents.
 *
 * Main entry point. Export all public APIs.
 */

// Core types
export type * from "./types.ts";
export type * from "./host.ts";

// DB module and API
export { crmDbModule, crmApi } from "./db.ts";

// Registry (plugin API)
export { crmRegistry } from "./registry.ts";
export type * from "./registry.ts";

// Web integration
export { registerCrmWeb } from "./web.ts";

// Tool integration
export { registerCrmTool } from "./tool.ts";

// Note: registerCrmTool requires ExtensionAPI and a function that returns CrmApi
// Example: registerCrmTool(pi, () => server.getExtension<CrmApi>("crm"))

// Utilities
export { readBody, jsonResponse } from "./host.ts";
