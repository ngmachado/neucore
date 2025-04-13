import { elizaLogger, IAgentRuntime } from "@elizaos/core";

/**
 * AlfaFrens configuration
 */
export interface AlfaFrensConfig {
    /** API key for the AlfaFrens API */
    apiKey: string;
    /** Channel ID for the AlfaFrens channel */
    channelId: string;
    /** User ID for the bot */
    userId: string;
    /** Username for the bot */
    username?: string;
    /** Base URL for the AlfaFrens API */
    baseUrl?: string;
    /** Polling interval in seconds */
    pollInterval?: number;
    /** Whether to enable post creation */
    enablePost?: boolean;
    /** Minimum interval between posts (seconds) */
    postIntervalMin?: number;
    /** Maximum interval between posts (seconds) */
    postIntervalMax?: number;
}

/**
 * Validates the AlfaFrens configuration
 * @param runtime The agent runtime
 * @returns The validated configuration
 * @throws Error if required fields are missing
 */
export function validateAlfaFrensConfig(runtime: IAgentRuntime): AlfaFrensConfig {
    const apiKey = runtime.getSetting("ALFAFRENS_API_KEY");
    const channelId = runtime.getSetting("ALFAFRENS_CHANNEL_ID");
    const userId = runtime.getSetting("ALFAFRENS_USER_ID");
    const baseUrl = runtime.getSetting("ALFAFRENS_API_URL") || process.env.ALFAFRENS_API_URL || "https://friendx-git-ai-api.preview.superfluid.finance";
    const username = runtime.getSetting("ALFAFRENS_USERNAME") || "AI Assistant";
    const pollInterval = Number(runtime.getSetting("ALFAFRENS_POLL_INTERVAL") || "15");
    const enablePost = runtime.getSetting("ALFAFRENS_ENABLE_POST") === "true";
    const postIntervalMin = Number(runtime.getSetting("ALFAFRENS_POST_INTERVAL_MIN") || "60");
    const postIntervalMax = Number(runtime.getSetting("ALFAFRENS_POST_INTERVAL_MAX") || "120");

    if (!apiKey) {
        throw new Error("ALFAFRENS_API_KEY is required");
    }

    if (!channelId) {
        throw new Error("ALFAFRENS_CHANNEL_ID is required");
    }

    if (!userId) {
        throw new Error("ALFAFRENS_USER_ID is required");
    }

    elizaLogger.debug("[AlfaFrensConfig] Configuration loaded:", {
        apiKey: "***",
        channelId,
        userId,
        baseUrl,
        username,
        pollInterval,
        enablePost,
        postIntervalMin,
        postIntervalMax
    });

    return {
        apiKey,
        channelId,
        userId,
        username,
        baseUrl,
        pollInterval,
        enablePost,
        postIntervalMin,
        postIntervalMax
    };
}

/**
 * environment variables for AlfaFrens client
 */
export const ALFAFRENS_ENV = {
    /** API key for authentication */
    API_KEY: "ALFAFRENS_API_KEY",
    /** user ID for the bot */
    USER_ID: "ALFAFRENS_USER_ID",
    /** channel ID to interact with */
    CHANNEL_ID: "ALFAFRENS_CHANNEL_ID",
    /** username for the bot */
    USERNAME: "ALFAFRENS_USERNAME",
    /** interval between polling for messages in seconds */
    POLL_INTERVAL: "ALFAFRENS_POLL_INTERVAL",
    /** whether to enable automated posting */
    ENABLE_POST: "ALFAFRENS_ENABLE_POST",
    /** minimum interval between posts in seconds */
    POST_INTERVAL_MIN: "ALFAFRENS_POST_INTERVAL_MIN",
    /** maximum interval between posts in seconds */
    POST_INTERVAL_MAX: "ALFAFRENS_POST_INTERVAL_MAX",
    /** model class for evaluation */
    EVALUATION_MODEL_CLASS: "ALFAFRENS_EVALUATION_MODEL_CLASS",
    /** model class for response generation */
    RESPONSE_MODEL_CLASS: "ALFAFRENS_RESPONSE_MODEL_CLASS",
    /** model class for post generation */
    POST_MODEL_CLASS: "ALFAFRENS_POST_MODEL_CLASS",
    /** number of messages to keep in history */
    HISTORY_COUNT: "ALFAFRENS_HISTORY_COUNT"
} as const;

/**
 * validate environment variables
 * @param runtime agent runtime
 * @returns true if all required variables are set
 */
export function validateAlfaFrensEnv(runtime: IAgentRuntime): boolean {
    const requiredVars = [
        ALFAFRENS_ENV.API_KEY,
        ALFAFRENS_ENV.USER_ID,
        ALFAFRENS_ENV.CHANNEL_ID
    ];

    const missingVars = requiredVars.filter(varName => !runtime.getSetting(varName));
    if (missingVars.length > 0) {
        elizaLogger.error("[AlfaFrens] missing required environment variables:", missingVars);
        return false;
    }

    return true;
} 