import { IAgentRuntime, elizaLogger, ModelClass, generateText, stringToUuid, UUID } from "@elizaos/core";
import type { AlfaFrensConfig, AlfaFrensMessage, AlfaFrensGenerationConfig } from "../types";
import { createAlfaFrensMemory } from "../memory";
import { FactValidationManager } from "./fact-validation";
import {
    DEFAULT_RESPONSE_TEMPLATE,
    DEFAULT_POST_TEMPLATE,
    DEFAULT_EVALUATION_TEMPLATE,
    getNumericSetting,
    parseModelClass,
    processTemplate,
    evaluateMessage,
    generatePostContent,
    generateResponse as generateResponseUtil
} from "./utils";
import { AlfaFrensTaskManager } from "./tasks";

export interface AlfaFrensClient {
    config: AlfaFrensConfig;
    getMessages(params: {
        roomId: string;
        since?: number;
        until?: number;
        includeReactions?: boolean;
        includeReplies?: boolean;
    }): Promise<AlfaFrensMessage[]>;
    createPost(params: {
        content: string;
        roomId: string;
    }): Promise<{ memory: any; message: AlfaFrensMessage }[]>;
    sendMessage(params: {
        content: string;
        roomId: string;
        inReplyTo?: string;
    }): Promise<{ memory: any; message: AlfaFrensMessage }[]>;
}

/**
 * options for configuring the AI interaction manager
 */
export interface AlfaFrensAIInteractionOptions {
    /** template for evaluating whether to respond to a message */
    evaluationTemplate?: string;
    /** template for generating responses to messages */
    responseTemplate?: string;
    /** model class to use for generation */
    modelClass?: ModelClass;
    /** interval between checking for new messages in seconds */
    intervalSeconds?: number;
    /** maximum number of messages to keep in history */
    maxHistoryLength?: number;
    /** template for generating post content */
    postTemplate?: string;
    /** pre-loaded generation configuration */
    generationConfig?: AlfaFrensGenerationConfig;
}

/**
 * helper function to get model class from settings with proper fallback
 */
function getModelClass(runtime: IAgentRuntime, settingName: string, fallbackSetting = "ALFAFRENS_MODEL_CLASS"): ModelClass | undefined {
    return parseModelClass(runtime.getSetting(settingName)) ||
        parseModelClass(runtime.getSetting(fallbackSetting));
}

/**
 * get config for AI operations with consistent fallbacks
 */
function getConfig<T extends 'evaluation' | 'response' | 'post'>(
    options: AlfaFrensAIInteractionOptions,
    runtime: IAgentRuntime,
    type: T
): { template: string, modelClass: ModelClass | undefined } {
    const defaultTemplates = {
        'evaluation': DEFAULT_EVALUATION_TEMPLATE,
        'response': DEFAULT_RESPONSE_TEMPLATE,
        'post': DEFAULT_POST_TEMPLATE
    };

    const settingNames = {
        'evaluation': 'ALFAFRENS_EVALUATION_MODEL_CLASS',
        'response': 'ALFAFRENS_RESPONSE_MODEL_CLASS',
        'post': 'ALFAFRENS_POST_MODEL_CLASS'
    };

    return {
        template: options[`${type}Template`] || defaultTemplates[type],
        modelClass: options.modelClass || getModelClass(runtime, settingNames[type])
    };
}

/**
 * an extension for AI-powered interactions with AlfaFrens messages
 */
export class AlfaFrensAIInteraction {
    private runtime: IAgentRuntime;
    private client: AlfaFrensClient;
    private factValidationManager: FactValidationManager;
    private taskManager: AlfaFrensTaskManager;
    private options: {
        evaluationTemplate?: string;
        responseTemplate?: string;
        postTemplate?: string;
        modelClass?: ModelClass;
        intervalSeconds?: number;
        maxHistoryLength?: number;
        generationConfig?: AlfaFrensGenerationConfig;
    };
    private isRunning: boolean = false;
    private messageHistory: AlfaFrensMessage[] = [];
    private lastProcessedTime: number = Date.now();
    private pollIntervalId: NodeJS.Timeout | null = null;
    private postIntervalId: NodeJS.Timeout | null = null;
    // Track our sent message IDs
    private sentMessageIds: Set<string> = new Set();

    /**
     * creates a new AI interaction manager
     * @param client the AlfaFrens client manager
     * @param runtime the agent runtime
     * @param options optional configuration options
     */
    constructor(client: AlfaFrensClient, runtime: IAgentRuntime, options: AlfaFrensAIInteractionOptions = {}) {
        elizaLogger.debug("[AlfaFrensAIInteraction] constructor called");
        this.client = client;
        this.runtime = runtime;
        this.options = options;
        this.factValidationManager = new FactValidationManager(runtime);
        this.taskManager = new AlfaFrensTaskManager(runtime);
    }

    /**
     * start the automated interaction service
     * @param intervalSeconds optional override for seconds between checking (default from options or 30)
     */
    async start(intervalSeconds?: number): Promise<void> {
        elizaLogger.debug("[AlfaFrensAIInteraction] start called with intervalSeconds:", intervalSeconds);
        if (this.isRunning) {
            elizaLogger.debug("[AlfaFrensAIInteraction] already running, returning early");
            return;
        }
        this.isRunning = true;

        const interval = intervalSeconds ||
            this.options.intervalSeconds ||
            getNumericSetting(this.runtime, "ALFAFRENS_POLL_INTERVAL_SECONDS", 30);

        elizaLogger.debug("[AlfaFrensAIInteraction] using interval:", interval, "seconds");
        elizaLogger.info(`[AlfaFrensAIInteraction] Starting AI interaction manager with interval: ${interval}s`);

        // Setup direct polling interval
        this.pollIntervalId = setInterval(() => {
            elizaLogger.debug("[AlfaFrensAIInteraction] Poll interval triggered");
            this.processMessages().catch(err => {
                elizaLogger.error("[AlfaFrensAIInteraction] Error processing messages:", err);
            });
        }, interval * 1000);

        // Run initial message processing
        await this.processMessages().catch(err => {
            elizaLogger.error("[AlfaFrensAIInteraction] Error in initial message processing:", err);
        });

        // Setup posting if enabled
        if (this.client.config.enablePost) {
            const postInterval = Math.floor(
                Math.random() * (this.client.config.postIntervalMax - this.client.config.postIntervalMin) +
                this.client.config.postIntervalMin
            );

            elizaLogger.debug(`[AlfaFrensAIInteraction] Setting up post interval: ${postInterval}s`);
            this.postIntervalId = setInterval(() => {
                elizaLogger.debug("[AlfaFrensAIInteraction] Post interval triggered");
                this.createPost().catch(err => {
                    elizaLogger.error("[AlfaFrensAIInteraction] Error creating post:", err);
                });
            }, postInterval * 1000);
        }

        elizaLogger.info("[AlfaFrensAIInteraction] Started successfully");
    }

    /**
     * stop the automated interaction service
     */
    async stop(): Promise<void> {
        if (!this.isRunning) {
            elizaLogger.debug("[AlfaFrensAIInteraction] already stopped");
            return;
        }

        elizaLogger.info("[AlfaFrensAIInteraction] Stopping AI interaction manager");
        this.isRunning = false;

        // Clear intervals
        if (this.pollIntervalId) {
            clearInterval(this.pollIntervalId);
            this.pollIntervalId = null;
        }

        if (this.postIntervalId) {
            clearInterval(this.postIntervalId);
            this.postIntervalId = null;
        }
    }

    /**
     * process messages from the API
     */
    private async processMessages(): Promise<void> {
        elizaLogger.debug(`[AlfaFrensAIInteraction.processMessages] Starting ${Date.now()}`);
        elizaLogger.debug(`Client polling state: isRunning=${this.isRunning}`);

        try {
            if (!this.isRunning) {
                elizaLogger.debug(`[AlfaFrensAIInteraction.processMessages] Not running, skipping message processing`);
                return;
            }

            // fetch new messages from the API with room ID
            elizaLogger.debug(`[AlfaFrensAIInteraction.processMessages] Current lastProcessedTime: ${this.lastProcessedTime}`);
            const startTimestamp = Date.now();

            elizaLogger.debug(`[AlfaFrensAIInteraction.processMessages] Fetching messages since ${this.lastProcessedTime}`);
            elizaLogger.debug(`[AlfaFrensAIInteraction.processMessages] About to call client.getMessages for room ${this.client.config.channelId}`);

            const messages = await this.client.getMessages({
                roomId: this.client.config.channelId,
                since: this.lastProcessedTime,
                includeReactions: false,
                includeReplies: false
            });

            elizaLogger.debug(`[AlfaFrensAIInteraction.processMessages] Retrieved ${messages.length} messages`);

            if (messages.length === 0) {
                elizaLogger.debug(`[AlfaFrensAIInteraction.processMessages] No new messages to process`);
                return;
            }

            // update our history with the new messages
            elizaLogger.debug(`[AlfaFrensAIInteraction.processMessages] Updating message history, current length: ${this.messageHistory.length}`);
            this.messageHistory = this.messageHistory
                .concat(messages)
                // keep the last 50 messages
                .slice(-50);
            elizaLogger.debug(`[AlfaFrensAIInteraction.processMessages] New history length: ${this.messageHistory.length}`);

            // update the last processed time
            const lastTimestamp = messages[messages.length - 1].timestamp;
            this.lastProcessedTime = new Date(lastTimestamp).getTime() + 1; // add 1ms to avoid duplicates
            elizaLogger.debug(`[AlfaFrensAIInteraction.processMessages] New lastProcessedTime: ${this.lastProcessedTime}`);

            // process the messages in batches (handle 10 at a time)
            const batchSize = 10;
            const messageBatches = [];

            for (let i = 0; i < messages.length; i += batchSize) {
                messageBatches.push(messages.slice(i, i + batchSize));
            }

            elizaLogger.debug(`[AlfaFrensAIInteraction.processMessages] Processing ${messageBatches.length} message batches`);

            for (const batch of messageBatches) {
                elizaLogger.debug(`[AlfaFrensAIInteraction.processMessages] Processing batch of ${batch.length} messages`);
                try {
                    await this.processMessageBatch(batch);
                } catch (batchError) {
                    elizaLogger.error(`[AlfaFrensAIInteraction.processMessages] Error processing batch: ${batchError instanceof Error ? batchError.message : String(batchError)}`);
                }
            }

            const endTimestamp = Date.now();
            const duration = endTimestamp - startTimestamp;
            elizaLogger.debug(`[AlfaFrensAIInteraction.processMessages] Processing completed in ${duration}ms`);
        } catch (error) {
            elizaLogger.error(`[AlfaFrensAIInteraction.processMessages] ERROR: ${error instanceof Error ? error.message : String(error)}`);
            if (error instanceof Error && error.stack) {
                elizaLogger.error(`[AlfaFrensAIInteraction.processMessages] Stack: ${error.stack}`);
            }
        } finally {
            elizaLogger.debug(`[AlfaFrensAIInteraction.processMessages] Completed ${Date.now()}`);
        }
    }

    /**
     * Process a single message batch
     */
    private async processMessageBatch(messages: AlfaFrensMessage[]): Promise<void> {
        for (const message of messages) {
            elizaLogger.debug(`[AlfaFrensAIInteraction.processMessageBatch] Processing message: ${message.id}`);
            elizaLogger.debug(`[AlfaFrensAIInteraction.processMessageBatch] Message sender: ${message.senderId}, our userId: ${this.client.config.userId}`);
            elizaLogger.debug(`[AlfaFrensAIInteraction.processMessageBatch] Message username: ${message.senderUsername}, our username: ${this.client.config.username}`);

            // Skip our own messages by checking against our tracked message IDs
            if (this.sentMessageIds.has(message.id)) {
                elizaLogger.debug(`[AlfaFrensAIInteraction.processMessageBatch] Skipping our own message (ID match)`);
                continue;
            }

            // Skip messages from our configured user ID if it matches
            if (message.senderId === this.client.config.userId) {
                elizaLogger.debug(`[AlfaFrensAIInteraction.processMessageBatch] Skipping message from our user ID`);
                continue;
            }

            // Check username with normalization (strip @ symbol)
            const normalizedMessageUsername = message.senderUsername?.replace('@', '') || '';
            const normalizedConfigUsername = this.client.config.username?.replace('@', '') || '';

            if (normalizedMessageUsername && normalizedConfigUsername &&
                normalizedMessageUsername === normalizedConfigUsername) {
                elizaLogger.debug(`[AlfaFrensAIInteraction.processMessageBatch] Skipping message from our normalized username: ${message.senderUsername} matches ${this.client.config.username}`);
                continue;
            }

            // Create memory for message history tracking
            const memory = createAlfaFrensMemory({
                roomId: stringToUuid(this.client.config.channelId),
                senderId: stringToUuid(message.senderId || "user"),
                runtime: this.runtime,
                message,
                isBotMessage: false
            });

            // Store message in memory manager
            try {
                await this.runtime.messageManager.createMemory(memory);
                elizaLogger.debug(`[AlfaFrensAIInteraction.processMessageBatch] Stored message in memory manager`);
            } catch (error) {
                elizaLogger.error(`[AlfaFrensAIInteraction.processMessageBatch] Failed to store message in memory:`, error);
            }

            // Evaluate if we should respond to this message
            const config = getConfig(this.options, this.runtime, 'evaluation');
            elizaLogger.debug(`[AlfaFrensAIInteraction.processMessageBatch] Evaluating message with template length ${config.template.length}`);

            try {
                const shouldRespond = await evaluateMessage(this.runtime, message, {
                    template: config.template,
                    modelClass: config.modelClass
                });

                if (!shouldRespond) {
                    elizaLogger.debug(`[AlfaFrensAIInteraction.processMessageBatch] Decided not to respond to message`);
                    continue;
                }

                // Generate a response using knowledge integration
                elizaLogger.debug(`[AlfaFrensAIInteraction.processMessageBatch] Generating response to message`);
                const responseConfig = getConfig(this.options, this.runtime, 'response');

                const response = await generateResponseUtil(
                    this.runtime,
                    this.client,  // Pass the client for knowledge access
                    message.content || "",
                    this.messageHistory.slice(-10),  // Use last 10 messages for context
                    responseConfig.template,
                    responseConfig.modelClass
                );

                // Send the response through API
                elizaLogger.debug(`[AlfaFrensAIInteraction.processMessageBatch] Sending response: ${response.substring(0, 50)}...`);

                try {
                    const result = await this.client.sendMessage({
                        content: response,
                        roomId: this.client.config.channelId,
                        inReplyTo: message.id
                    });

                    // Track the message ID we just sent
                    if (result && result.length > 0 && result[0].message && result[0].message.id) {
                        this.sentMessageIds.add(result[0].message.id);
                        elizaLogger.debug(`[AlfaFrensAIInteraction.processMessageBatch] Tracked our sent message ID: ${result[0].message.id}`);
                    }

                    elizaLogger.debug(`[AlfaFrensAIInteraction.processMessageBatch] Response sent successfully`);
                } catch (error) {
                    elizaLogger.error(`[AlfaFrensAIInteraction.processMessageBatch] Failed to send response:`, error);
                }
            } catch (error) {
                elizaLogger.error(`[AlfaFrensAIInteraction.processMessageBatch] Error processing message:`, error);
            }
        }
    }

    /**
     * format the conversation history for context
     * @returns formatted conversation history
     */
    private formatConversationHistory(): string {
        if (this.messageHistory.length === 0) {
            return "No previous messages.";
        }

        // get number of history messages from character file or default to 5
        const historyCount = getNumericSetting(this.runtime, "ALFAFRENS_HISTORY_COUNT", 5);

        // get the recent messages
        const recentMessages = this.messageHistory.slice(-historyCount);

        return recentMessages.map(msg => {
            const role = msg.senderId === this.client.config.userId ?
                "ASSISTANT" :
                `USER (${msg.senderUsername})`;
            return `${role}: ${msg.content}`;
        }).join("\n\n");
    }

    /**
     * generate and create a new post
     * @param customContent optional custom content to post
     * @returns the created post
     */
    async createPost(customContent?: string): Promise<any> {
        try {
            elizaLogger.info("[AlfaFrensAIInteraction] Starting post creation");
            const content = customContent || await this.generatePostContent();
            elizaLogger.info("[AlfaFrensAIInteraction] Generated post content:", {
                contentLength: content.length,
                content: content
            });

            // format content
            const formattedContent = content;

            const result = await this.client.createPost({
                content: formattedContent,
                roomId: this.client.config.channelId
            });

            // Track the post ID we just created
            if (result && result.length > 0 && result[0].message && result[0].message.id) {
                this.sentMessageIds.add(result[0].message.id);
                elizaLogger.debug(`[AlfaFrensAIInteraction] Tracked our sent post ID: ${result[0].message.id}`);
            }

            elizaLogger.info("[AlfaFrensAIInteraction] Post created successfully:", {
                messageId: result[0].message.id,
                timestamp: result[0].message.timestamp
            });
            return result;
        } catch (error) {
            elizaLogger.error("[AlfaFrensAIInteraction] Failed to create post:", error);
            throw error;
        }
    }

    /**
     * generate content for a post using the AI
     * @param customTemplate optional override template for this specific generation
     * @returns generated post content
     */
    private async generatePostContent(customTemplate?: string): Promise<string> {
        const config = customTemplate ?
            { template: customTemplate, modelClass: getModelClass(this.runtime, "ALFAFRENS_POST_MODEL_CLASS") } :
            getConfig(this.options, this.runtime, 'post');

        return generatePostContent(this.runtime, config);
    }

    private async extractFacts(content: string): Promise<string[]> {
        const prompt = `Extract factual statements from this text. Return them as a JSON array of strings.
        Only include clear, factual statements, not opinions or subjective content.
        
        Text: "${content}"
        
        Example response:
        ["John lives in New York", "The company was founded in 2020"]
        `;

        try {
            const result = await generateText({
                runtime: this.runtime,
                context: prompt,
                modelClass: ModelClass.SMALL,
            });

            const facts = JSON.parse(result);
            if (!Array.isArray(facts)) {
                elizaLogger.error("[AlfaFrensAIInteraction] Invalid fact extraction result:", result);
                return [];
            }
            return facts;
        } catch (error) {
            elizaLogger.error("[AlfaFrensAIInteraction] Failed to extract facts:", error);
            return [];
        }
    }
}