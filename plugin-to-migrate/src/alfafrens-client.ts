import { elizaLogger, IAgentRuntime, ClientInstance, stringToUuid, Client, Action, Memory, UUID } from "@elizaos/core";
import { AlfaFrensApi } from "./api";
import { loadAlfaFrensConfig } from "./config";
import { createAlfaFrensMemory } from "./memory";
import { generatePostContent, parseModelClass, DEFAULT_POST_TEMPLATE, evaluateMessage, DEFAULT_EVALUATION_TEMPLATE } from "./extensions/utils";
import { AlfaFrensAIInteraction, AlfaFrensClient } from "./extensions/ai-interaction";
import { AlfaFrensConfig, AlfaFrensGenerationConfig, AlfaFrensMessage, AlfaFrensSendMessageResponse, AlfaFrensMemoryContent } from "./types";

// Configure ElizaOS logger
elizaLogger.debug("Initializing AlfaFrens client");

// Type extension for the reply action
type AlfaFrensReplyContent = AlfaFrensMemoryContent & { messageId?: string };

// Define action implementations first
/**
 * replies to a message in the AlfaFrens channel
 */
export const replyAlfaFrensMessageAction: Action = {
    name: "ALFAFRENS_REPLY",
    description: "replies to a specific message in the AlfaFrens channel",
    similes: ["reply", "respond", "answer", "comment"],
    examples: [[
        {
            user: "user",
            content: {
                text: "reply to message 123 with 'Thanks for your input!'",
                action: "ALFAFRENS_REPLY",
                messageId: "123"
            }
        }
    ]],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const content = message.content as AlfaFrensReplyContent;
        if (!content?.text) {
            elizaLogger.error("[AlfaFrens] reply content is missing");
            return false;
        }
        if (!content?.messageId) {
            elizaLogger.error("[AlfaFrens] messageId to reply to is missing");
            return false;
        }
        return true;
    },
    handler: async (runtime: IAgentRuntime, message: Memory) => {
        const content = message.content as AlfaFrensReplyContent;
        const client = runtime.clients.find(c =>
            c.constructor.name === "AlfaFrensManager") as unknown as AlfaFrensManager;
        if (!client) {
            elizaLogger.error("[AlfaFrens] client not found");
            return false;
        }

        try {
            await client.sendMessage({
                content: content.text,
                roomId: client.config.channelId,
                inReplyTo: content.messageId
            });
            return true;
        } catch (error) {
            elizaLogger.error("[AlfaFrens] failed to reply to message:", error);
            return false;
        }
    }
};

/**
 * sends a message to the AlfaFrens channel
 */
export const sendAlfaFrensMessageAction: Action = {
    name: "ALFAFRENS_SEND_MESSAGE",
    description: "sends a message to the AlfaFrens channel",
    similes: ["send", "message", "chat", "respond"],
    examples: [[
        {
            user: "user",
            content: {
                text: "send a message to AlfaFrens",
                action: "ALFAFRENS_SEND_MESSAGE"
            }
        }
    ]],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const content = message.content as AlfaFrensMemoryContent;
        if (!content?.text) {
            elizaLogger.error("[AlfaFrens] message content is missing");
            return false;
        }
        return true;
    },
    handler: async (runtime: IAgentRuntime, message: Memory) => {
        const content = message.content as AlfaFrensMemoryContent;
        const client = runtime.clients.find(c =>
            c.constructor.name === "AlfaFrensManager") as unknown as AlfaFrensManager;
        if (!client) {
            elizaLogger.error("[AlfaFrens] client not found");
            return false;
        }

        try {
            await client.sendMessage({
                content: content.text,
                roomId: client.config.channelId
            });
            return true;
        } catch (error) {
            elizaLogger.error("[AlfaFrens] failed to send message:", error);
            return false;
        }
    }
};

/**
 * creates a new post in the AlfaFrens channel
 */
export const createAlfaFrensPostAction: Action = {
    name: "ALFAFRENS_CREATE_POST",
    description: "creates a new post in the AlfaFrens channel",
    similes: ["post", "share", "announce", "publish"],
    examples: [[
        {
            user: "user",
            content: {
                text: "create a post in AlfaFrens",
                action: "ALFAFRENS_CREATE_POST"
            }
        }
    ]],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const content = message.content as AlfaFrensMemoryContent;
        if (!content?.text) {
            elizaLogger.error("[AlfaFrens] post content is missing");
            return false;
        }
        return true;
    },
    handler: async (runtime: IAgentRuntime, message: Memory) => {
        const content = message.content as AlfaFrensMemoryContent;
        const client = runtime.clients.find(c =>
            c.constructor.name === "AlfaFrensManager") as unknown as AlfaFrensManager;
        if (!client) {
            elizaLogger.error("[AlfaFrens] client not found");
            return false;
        }

        try {
            await client.createPost({
                content: content.text,
                roomId: client.config.channelId
            });
            return true;
        } catch (error) {
            elizaLogger.error("[AlfaFrens] failed to create post:", error);
            return false;
        }
    }
};

/**
 * Manager for interacting with AlfaFrens API
 */
export class AlfaFrensManager implements ClientInstance, AlfaFrensClient {
    /**
     * API client
     */
    api: AlfaFrensApi;

    /**
     * Configuration
     */
    config: AlfaFrensConfig;

    /**
     * Pre-loaded generation configuration
     */
    private generationConfig: AlfaFrensGenerationConfig;

    /**
     * AI interaction manager
     */
    aiInteraction: AlfaFrensAIInteraction | null = null;

    /**
     * Agent runtime
     */
    runtime: IAgentRuntime;

    /**
     * Current operation status
     */
    isRunning = false;

    /**
     * Last processed time for messages
     */
    private lastProcessedTime: number = 0;

    /**
     * Client name for ElizaOS
     */
    name = "alfafrens";

    /**
     * Client description for ElizaOS
     */
    description = "AlfaFrens client manager";

    /**
     * Create a new AlfaFrens manager
     * @param runtime Agent runtime
     */
    constructor(runtime: IAgentRuntime) {
        elizaLogger.debug("[AlfaFrensManager] Initializing with runtime");

        this.runtime = runtime;

        this.config = {
            apiKey: runtime.getSetting("ALFAFRENS_API_KEY") || "",
            userId: runtime.getSetting("ALFAFRENS_USER_ID") || "",
            channelId: runtime.getSetting("ALFAFRENS_CHANNEL_ID"),
            username: runtime.getSetting("ALFAFRENS_USERNAME") || "AI Assistant",
            pollInterval: parseInt(runtime.getSetting("ALFAFRENS_POLL_INTERVAL") || "15"),
            enablePost: runtime.getSetting("ALFAFRENS_ENABLE_POST") === "true",
            postIntervalMin: parseInt(runtime.getSetting("ALFAFRENS_POST_INTERVAL_MIN") || "3600"),
            postIntervalMax: parseInt(runtime.getSetting("ALFAFRENS_POST_INTERVAL_MAX") || "7200")
        };

        // Ensure API key is provided
        if (!this.config.apiKey) {
            throw new Error("AlfaFrens API key is required");
        }

        // Create the API client
        this.api = new AlfaFrensApi(this.config.apiKey, this.config.channelId);

        // Load the generation configuration
        this.generationConfig = loadAlfaFrensConfig(runtime);

        // Initialize AI interaction
        this.aiInteraction = new AlfaFrensAIInteraction(
            this,
            runtime,
            {
                evaluationTemplate: this.generationConfig.evaluation.template,
                responseTemplate: this.generationConfig.response.template,
                modelClass: this.generationConfig.response.modelClass,
                intervalSeconds: this.config.pollInterval,
                postTemplate: this.generationConfig.post.template,
                generationConfig: this.generationConfig
            }
        );

        elizaLogger.debug("[AlfaFrensManager] Initialized successfully");
    }

    async initialize(runtime: IAgentRuntime): Promise<void> {
        elizaLogger.debug("AlfaFrensManager.initialize called");
        if (this.isRunning) {
            elizaLogger.debug("AlfaFrensManager already running, returning early");
            elizaLogger.warn("[AlfaFrensManager] Already running");
            return;
        }

        elizaLogger.info("[AlfaFrensManager] Starting AlfaFrens client");
        this.isRunning = true;

        try {
            // Get last processed time from cache
            elizaLogger.debug("AlfaFrensManager getting last processed time from cache");
            const cached = await this.runtime.cacheManager.get<number>("alfafrens_last_processed_time");
            this.lastProcessedTime = cached || Date.now() - (5 * 60 * 1000); // Default to 5 minutes ago
            elizaLogger.debug("AlfaFrensManager lastProcessedTime set to:", this.lastProcessedTime);

            // Register AlfaFrens actions with ElizaOS
            const { registerAlfaFrensActions } = await import("./extensions/actions");
            registerAlfaFrensActions(this, runtime);
            elizaLogger.debug("AlfaFrensManager registered actions with ElizaOS");

            // Start AI interaction with poll interval
            elizaLogger.debug("AlfaFrensManager starting aiInteraction with poll interval:", this.config.pollInterval);
            await this.aiInteraction?.start(this.config.pollInterval);
            elizaLogger.debug("AlfaFrensManager aiInteraction.start completed");

            // Make initial post when bot starts
            elizaLogger.info("[AlfaFrensManager] Making initial post...");
            const initialMessage = "Hey AlfaFrens! I'm back online and ready to help with your questions. Feel free to ask anything!";
            await this.sendMessage({
                content: initialMessage,
                roomId: this.config.channelId
            });
            elizaLogger.info("[AlfaFrensManager] Initial post sent successfully");
        } catch (error) {
            elizaLogger.error("[AlfaFrensManager] ERROR in AlfaFrensManager.initialize:", error);
            elizaLogger.error("[AlfaFrensManager] Failed to start:", error);
            this.isRunning = false;
            throw error;
        }
    }

    async stop(runtime: IAgentRuntime): Promise<unknown> {
        if (!this.isRunning) {
            elizaLogger.warn("[AlfaFrensManager] Not running");
            return;
        }

        elizaLogger.info("[AlfaFrensManager] Stopping AlfaFrens client");
        this.isRunning = false;

        try {
            // Save last processed time to cache
            await this.runtime.cacheManager.set("alfafrens_last_processed_time", this.lastProcessedTime);

            // Stop AI interaction
            await this.aiInteraction?.stop();
        } catch (error) {
            elizaLogger.error("[AlfaFrensManager] Failed to stop:", error);
            throw error;
        }
    }

    /**
     * Get messages from AlfaFrens API
     */
    async getMessages(params: {
        roomId: string;
        since?: number;
        until?: number;
        includeReactions?: boolean;
        includeReplies?: boolean;
    }): Promise<AlfaFrensMessage[]> {
        try {
            // Call the API to get messages
            const messages = await this.api.getMessages({
                since: params.since,
                until: params.until,
                includeReactions: params.includeReactions,
                includeReplies: params.includeReplies
            });
            return messages;
        } catch (error) {
            elizaLogger.error("[AlfaFrensManager] Error getting messages:", error);
            throw error;
        }
    }

    /**
     * Creates a message from API response and prepares memory
     */
    private prepareMessageAndMemory(response: AlfaFrensSendMessageResponse, content: string, roomId: string): { memory: any; message: AlfaFrensMessage } {
        const message = createMessageFromResponse(response, content);

        // Set sender info
        message.senderId = this.config.userId;
        message.senderUsername = this.config.username || "AI Assistant";

        const memory = createAlfaFrensMemory({
            roomId: stringToUuid(roomId),
            senderId: this.runtime.agentId,
            runtime: this.runtime,
            message,
            isBotMessage: true // This is a message from the bot
        });

        return { memory, message };
    }

    async sendMessage(params: {
        content: string;
        roomId: string;
        inReplyTo?: string;
    }): Promise<{ memory: any; message: AlfaFrensMessage }[]> {
        try {
            elizaLogger.debug("[AlfaFrensManager] Sending message:", {
                contentLength: params.content.length,
                roomId: params.roomId,
                inReplyTo: params.inReplyTo
            });

            // Use appropriate method based on whether it's a reply
            let response;
            if (params.inReplyTo) {
                response = await this.api.replyMessage(params.content, params.inReplyTo);
            } else {
                response = await this.api.sendMessage(params.content);
            }

            const result = this.prepareMessageAndMemory(response, params.content, params.roomId);

            elizaLogger.debug("[AlfaFrensManager] Message sent successfully");
            return [result];
        } catch (error) {
            elizaLogger.error('[AlfaFrensManager] Failed to send message:', error);
            throw error;
        }
    }

    async createPost(params: {
        content: string;
        roomId: string;
    }): Promise<{ memory: any; message: AlfaFrensMessage }[]> {
        try {
            elizaLogger.debug("[AlfaFrensManager] Creating post:", {
                contentLength: params.content.length,
                roomId: params.roomId
            });

            const response = await this.api.createPost(params.content);

            const result = this.prepareMessageAndMemory(response, params.content, params.roomId);

            elizaLogger.debug("[AlfaFrensManager] Post created successfully");
            return [result];
        } catch (error) {
            elizaLogger.error('[AlfaFrensManager] Failed to create post:', error);
            throw error;
        }
    }

    /**
     * Search knowledge base using ElizaOS's built-in knowledge system
     * @param query Search query
     * @param limit Maximum number of results
     */
    async searchKnowledge(query: string, limit: number = 5): Promise<any[]> {
        try {
            // Use ElizaOS's built-in RAG knowledge system
            const results = await this.runtime.ragKnowledgeManager.getKnowledge({
                query: query,
                limit: limit,
                agentId: this.runtime.agentId
            });
            return results;
        } catch (error) {
            elizaLogger.error("[AlfaFrensManager] Error searching knowledge:", error);
            return [];
        }
    }

    /**
     * Get knowledge context for a given query
     * @param query Search query
     */
    async getKnowledgeContext(query: string): Promise<string> {
        try {
            const results = await this.searchKnowledge(query);
            if (results && results.length > 0) {
                return results.map(r => r.content).join("\n\n");
            }
            return "";
        } catch (error) {
            elizaLogger.error("[AlfaFrensManager] Error getting knowledge context:", error);
            return "";
        }
    }
}

export const AlfaFrensClientInterface: Client = {
    name: "alfafrens",

    async start(runtime: IAgentRuntime): Promise<ClientInstance> {
        elizaLogger.debug("AlfaFrensClientInterface.start called");
        elizaLogger.info("[AlfaFrensClient] Starting client");
        const manager = new AlfaFrensManager(runtime);
        elizaLogger.debug("AlfaFrensClientInterface created new AlfaFrensManager instance");
        await manager.initialize(runtime);
        elizaLogger.debug("AlfaFrensClientInterface called initialize on manager");
        return manager;
    }
};

// Export the actions array
export const actions = [
    sendAlfaFrensMessageAction,
    createAlfaFrensPostAction,
    replyAlfaFrensMessageAction
];

/**
 * Converts API response to AlfaFrensMessage
 */
function createMessageFromResponse(response: AlfaFrensSendMessageResponse, content: string): AlfaFrensMessage {
    return {
        id: response.messageId,
        timestamp: response.timestamp,
        content: content,
        senderId: "", // Will be set from config
        senderUsername: "" // Will be set from config
    };
} 