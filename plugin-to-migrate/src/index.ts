import { Client } from "@elizaos/core";
import { AlfaFrensClientInterface } from "./alfafrens-client";
import plugin from "./plugin";

// Export the plugin as default
export default plugin;

// Export types and interfaces
export type { AlfaFrensMessage, AlfaFrensSendMessageResponse, GetMessagesOptions } from "./types";
export type { AlfaFrensConfig } from "./environment";

// Re-export the API client
export { AlfaFrensApi } from "./api";

// Re-export extensions (optional AI capabilities)
export * as Extensions from "./extensions";

// Export the client interface
export const AlfaFrensClient: Client = AlfaFrensClientInterface;

// Export all client interfaces
export { AlfaFrensClientInterface };

// Export types
export * from "./types";

// Export memory functions
export { createAlfaFrensMemory } from "./memory";

// Export actions
export { actions as alfaFrensActions } from "./actions"; 