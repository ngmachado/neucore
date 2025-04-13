import { IAgentRuntime, ModelClass } from "@elizaos/core";
import { AlfaFrensGenerationConfig } from "./types";
import { DEFAULT_POST_TEMPLATE, DEFAULT_RESPONSE_TEMPLATE, DEFAULT_EVALUATION_TEMPLATE } from "./extensions/utils";

/**
 * load AlfaFrens configuration from runtime settings
 * @param runtime agent runtime
 * @returns loaded configuration
 */
export function loadAlfaFrensConfig(runtime: IAgentRuntime): AlfaFrensGenerationConfig {
    const defaultModelClass = parseModelClass(runtime.getSetting("ALFAFRENS_MODEL_CLASS"));

    return {
        evaluation: {
            template: runtime.getSetting("ALFAFRENS_EVALUATION_TEMPLATE") || "",
            modelClass: parseModelClass(runtime.getSetting("ALFAFRENS_EVALUATION_MODEL_CLASS")) || defaultModelClass
        },
        response: {
            template: runtime.getSetting("ALFAFRENS_RESPONSE_TEMPLATE") || "",
            modelClass: parseModelClass(runtime.getSetting("ALFAFRENS_RESPONSE_MODEL_CLASS")) || defaultModelClass
        },
        post: {
            template: runtime.getSetting("ALFAFRENS_POST_TEMPLATE") || "",
            modelClass: parseModelClass(runtime.getSetting("ALFAFRENS_POST_MODEL_CLASS")) || defaultModelClass
        }
    };
}

/**
 * Parse a model class string to ModelClass enum
 */
function parseModelClass(modelClass?: string): ModelClass | undefined {
    if (!modelClass) return undefined;

    switch (modelClass.toUpperCase()) {
        case "SMALL": return ModelClass.SMALL;
        case "MEDIUM": return ModelClass.MEDIUM;
        case "LARGE": return ModelClass.LARGE;
        default: return undefined;
    }
} 