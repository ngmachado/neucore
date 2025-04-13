import { AlfaFrensClientInterface } from "./alfafrens-client";
import { elizaLogger, Plugin } from "@elizaos/core";
import { actions as alfaFrensActions } from "./actions";

elizaLogger.debug("[AlfaFrensPlugin] Initializing plugin");

/**
 * plugin for AlfaFrens client
 */
export const AlfaFrensPlugin: Plugin = {
    name: "alfafrens",
    description: "AlfaFrens client plugin",
    clients: [AlfaFrensClientInterface],
    actions: alfaFrensActions
};

elizaLogger.debug("[AlfaFrensPlugin] Plugin initialized");

export default AlfaFrensPlugin; 