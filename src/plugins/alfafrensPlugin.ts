/**
 * Alfafrens Plugin for Neurocore
 * 
 * This plugin implements the integration with Alfafrens API service,
 * allowing for message retrieval, sending, and posting.
 */

import { IPlugin, PluginResult, RequestContext } from '../mcp/interfaces/plugin';
import { Intent } from '../mcp/intent';
import { UUID } from '../types';
import { Memory, MemoryType } from '../core/memory/types';
import { LogLevel, TraitContext } from '../types';
import { MCP } from '../mcp/mcp';
import { join, dirname } from 'path';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { TemplateIntegration } from './alfafrens/templateIntegration';

// Alfafrens specific types
interface AlfaFrensConfig {
    /** API key for authentication */
    apiKey: string;
    /** user ID for the bot */
    userId: string;
    /** channel ID to interact with */
    channelId: string;
    /** username for the bot */
    username: string;
    /** interval between polling for messages in seconds */
    pollInterval: number;
    /** whether to enable automated posting */
    enablePost: boolean;
    /** minimum interval between posts in seconds */
    postIntervalMin: number;
    /** maximum interval between posts in seconds */
    postIntervalMax: number;
    /** test server configuration */
    testServer?: TestServerConfig;
}

interface AlfaFrensMessage {
    /** unique message ID */
    id: string;
    /** ID of the message sender */
    senderId: string;
    /** username of the message sender */
    senderUsername: string;
    /** message content */
    content: string;
    /** timestamp of the message */
    timestamp: string;
    /** ID of the message being replied to */
    replyTo?: string;
    /** Optional reactions to this message */
    reactions?: Array<{
        emoji: string;
        count: number;
        userIds: string[];
    }>;
}

interface AlfaFrensSendMessageResponse {
    /** Status of the request (success, error) */
    status: string;
    /** Unique ID of the created message */
    messageId: string;
    /** Timestamp when the message was created */
    timestamp: string;
}

// Add test server interfaces
interface TestMessage {
    id: string;
    senderId: string;
    senderUsername: string;
    content: string;
    timestamp: string;
    replyTo?: string;
}

interface TestServerConfig {
    port: number;
    enabled: boolean;
}

/**
 * API client for communicating with Alfafrens API
 */
class AlfaFrensApi {
    private baseUrl: string;

    constructor(
        private apiKey: string,
        private channelId: string,
        baseUrl?: string
    ) {
        console.log("[AlfaFrensApi] constructor called with channelId:", channelId);
        this.baseUrl = baseUrl || process.env.ALFAFRENS_API_URL || "https://friendx-git-ai-api.preview.superfluid.finance";
        console.log("[AlfaFrensApi] using baseUrl:", this.baseUrl);
    }

    private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
        console.log("[AlfaFrensApi] fetch called with path:", path);
        const response = await fetch(`${this.baseUrl}${path}`, {
            ...options,
            headers: {
                "x-api-key": this.apiKey,
                "Content-Type": "application/json",
                ...options.headers
            }
        });

        console.log("[AlfaFrensApi] fetch response status:", response.status);
        if (!response.ok) {
            const errorText = await response.text();
            console.error("[AlfaFrensApi] API Error:", {
                status: response.status,
                statusText: response.statusText,
                body: errorText
            });
            throw new Error(`API request failed: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("[AlfaFrensApi] fetch response data type:", Array.isArray(data) ? `Array[${data.length}]` : typeof data);
        return data;
    }

    /**
     * Gets messages from the channel
     */
    async getMessages(options: {
        since?: number;
        until?: number;
        includeReactions?: boolean;
        includeReplies?: boolean;
    } = {}): Promise<AlfaFrensMessage[]> {
        console.log("[AlfaFrensApi] getMessages called with options:", options);
        try {
            // Build URL with since parameter
            let url = `/api/ai/getChannelMessages?since=${options.since || Date.now() - 3600000}`;

            // Add until parameter if provided
            if (options.until) {
                url += `&until=${options.until}`;
            }

            // Add include parameter for reactions and replies
            if (options.includeReactions || options.includeReplies) {
                let includeValues = [];

                if (options.includeReactions) {
                    includeValues.push("reactions");
                }

                if (options.includeReplies) {
                    // Always include reactions when including replies for proper display
                    includeValues = ["reactions", "replies"];
                }

                if (includeValues.length > 0) {
                    url += "&include=" + includeValues.join(",");
                }
            }

            console.log("[AlfaFrensApi] Fetching messages with URL:", url);

            // The API returns an array directly
            const response = await this.fetch<AlfaFrensMessage[]>(url);

            if (response.length > 0) {
                console.log(`[AlfaFrensApi] Retrieved ${response.length} messages`);
            }

            return response;
        } catch (error) {
            console.error("[AlfaFrensApi] Error retrieving messages:", error);
            throw error;
        }
    }

    /**
     * Sends a new message to the channel
     */
    async sendMessage(content: string): Promise<AlfaFrensSendMessageResponse> {
        return this.sendMessageWithOptions(content);
    }

    /**
     * Replies to an existing message in the channel
     */
    async replyMessage(content: string, replyToPostId: string): Promise<AlfaFrensSendMessageResponse> {
        return this.sendMessageWithOptions(content, replyToPostId);
    }

    /**
     * Creates a new post in the channel
     */
    async createPost(content: string): Promise<AlfaFrensSendMessageResponse> {
        return this.sendMessageWithOptions(content);
    }

    /**
     * Internal method to send messages with options
     */
    private async sendMessageWithOptions(content: string, replyTo?: string): Promise<AlfaFrensSendMessageResponse> {
        try {
            const payload: any = {
                content: content.trim()
            };

            if (replyTo) {
                payload.replyToPostId = replyTo;
            }

            const response = await this.fetch<AlfaFrensSendMessageResponse>('/api/ai/postMessage', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            return response;
        } catch (error) {
            console.error('[AlfaFrensApi] Error sending message:', error);
            throw error;
        }
    }
}

/**
 * Implementation of the Alfafrens plugin for Neurocore
 */
export class AlfafrensPlugin implements IPlugin {
    private initialized: boolean = false;
    private config: AlfaFrensConfig;
    private api: AlfaFrensApi;
    private memoryManager: any; // Will be provided by Neurocore
    private logger: any; // Will be provided by Neurocore
    private pollInterval?: NodeJS.Timeout;
    private postInterval?: NodeJS.Timeout;
    private lastProcessedTime: number = 0;
    private mcp: MCP; // Added MCP for intent-based communication
    private characterId: string | null = null;
    private pluginDirectory: string;
    private testServer: http.Server | null = null;
    private testMessages: TestMessage[] = [];
    private testServerConfig: TestServerConfig = {
        port: 3000,
        enabled: false
    };
    private templateIntegration: TemplateIntegration | null = null;

    constructor(options: {
        memoryManager: any;
        logger: any;
        mcp: MCP; // Added MCP as a required dependency
        config?: Partial<AlfaFrensConfig>;
        pluginDirectory?: string;
    }) {
        this.memoryManager = options.memoryManager;
        this.logger = options.logger || console;
        this.mcp = options.mcp; // Store the MCP for later use

        // Default configuration with environment variables
        this.config = {
            apiKey: process.env.ALFAFRENS_API_KEY || '',
            userId: process.env.ALFAFRENS_USER_ID || '',
            channelId: process.env.ALFAFRENS_CHANNEL_ID || '',
            username: process.env.ALFAFRENS_USERNAME || 'AI Assistant',
            pollInterval: parseInt(process.env.ALFAFRENS_POLL_INTERVAL || '15'),
            enablePost: process.env.ALFAFRENS_ENABLE_POST === 'true',
            postIntervalMin: parseInt(process.env.ALFAFRENS_POST_INTERVAL_MIN || '3600'),
            postIntervalMax: parseInt(process.env.ALFAFRENS_POST_INTERVAL_MAX || '7200')
        };

        // Override with any provided config
        if (options.config) {
            this.config = {
                ...this.config,
                ...options.config
            };
        }

        // Create API client
        this.api = new AlfaFrensApi(this.config.apiKey, this.config.channelId);

        // Store plugin directory
        this.pluginDirectory = options.pluginDirectory || join(__dirname);
    }

    /**
     * List of supported intents
     */
    public supportedIntents(): string[] {
        return [
            'alfafrens:getMessages',
            'alfafrens:sendMessage',
            'alfafrens:replyMessage',
            'alfafrens:createPost',
            'alfafrens:startPolling',
            'alfafrens:stopPolling',
            'alfafrens:testAI'
        ];
    }

    /**
     * Initialize the plugin
     */
    public async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        this.logger.log(LogLevel.INFO, 'Initializing Alfafrens plugin...');

        try {
            // Get plugin directory
            this.pluginDirectory = dirname(dirname(__dirname));

            // Initialize test server if enabled
            if (this.config.testServer?.enabled) {
                this.testServerConfig = this.config.testServer;
                this.startTestServer();
            }

            // Load the character for the bot
            if (!this.characterId) {
                try {
                    // Make sure the character file exists
                    const characterFilePath = path.join(process.cwd(), 'data', 'characters', 'alfafrens-bot.json');
                    if (!fs.existsSync(characterFilePath)) {
                        this.logger.log(LogLevel.ERROR, `Character file does not exist at ${characterFilePath}`);
                        // Create a basic character if it doesn't exist
                        const basicCharacter = {
                            id: "alfafrens-bot",
                            name: "Alfafrens Assistant",
                            description: "A helpful assistant for the Alfafrens community",
                            traits: {
                                personality: ["friendly", "helpful"],
                                knowledge: ["Web3"],
                                voice: ["clear", "conversational"],
                                style: ["concise", "informative"]
                            }
                        };

                        // Ensure directory exists
                        const characterDir = path.dirname(characterFilePath);
                        if (!fs.existsSync(characterDir)) {
                            fs.mkdirSync(characterDir, { recursive: true });
                        }

                        fs.writeFileSync(characterFilePath, JSON.stringify(basicCharacter, null, 2));
                        this.logger.log(LogLevel.INFO, `Created basic character file at ${characterFilePath}`);
                    }

                    // Use character:load intent to load the character
                    const characterIntent = new Intent('character:load', {
                        characterId: 'alfafrens-bot',
                        filePath: characterFilePath
                    });

                    const result = await this.mcp.executeIntent(characterIntent);

                    if (result.success) {
                        this.characterId = result.data.characterId;
                        this.logger.log(LogLevel.INFO, `Loaded character with ID: ${this.characterId}`);
                    } else {
                        this.logger.log(LogLevel.ERROR, `Failed to load character: ${result.error}`);
                        this.characterId = 'alfafrens-bot'; // Use default ID as fallback
                    }
                } catch (error) {
                    this.logger.log(LogLevel.ERROR, `Error loading character: ${error instanceof Error ? error.message : String(error)}`);
                    this.characterId = 'alfafrens-bot'; // Use default ID as fallback
                }
            }

            // Create API client
            this.api = new AlfaFrensApi(
                this.config.apiKey,
                this.config.channelId
            );

            // Initialize template integration
            try {
                this.templateIntegration = new TemplateIntegration({
                    mcp: this.mcp,
                    logger: this.logger,
                    botConfig: this.config
                });
                await this.templateIntegration.initialize();
                this.logger.log(LogLevel.INFO, 'Template integration initialized');

                // Set character information if available
                if (this.characterId) {
                    // Load character traits
                    const getCharacterIntent = new Intent('character:get', {
                        characterId: this.characterId
                    });

                    const characterResult = await this.mcp.executeIntent(getCharacterIntent);

                    if (characterResult.success && characterResult.data.character) {
                        const character = characterResult.data.character;
                        if (character.traits) {
                            this.templateIntegration.setCharacter(this.characterId, character.traits);
                            this.logger.log(LogLevel.DEBUG, 'Character traits set for template integration');
                        }
                    }
                }
            } catch (error) {
                this.logger.log(LogLevel.ERROR, 'Failed to initialize template integration', error);
                this.logger.log(LogLevel.WARN, 'Continuing without template formatting');
            }

            this.initialized = true;
            this.logger.log(LogLevel.INFO, 'Alfafrens plugin initialized successfully');
        } catch (error) {
            this.logger.log(LogLevel.ERROR, `Failed to initialize Alfafrens plugin: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }

    /**
     * Shutdown the plugin
     */
    public async shutdown(): Promise<void> {
        // Stop polling
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = undefined;
        }

        // Stop post scheduling
        if (this.postInterval) {
            clearTimeout(this.postInterval);
            this.postInterval = undefined;
        }

        // Shutdown test server if running
        if (this.testServer) {
            this.testServer.close();
            this.testServer = null;
            this.logger.log(LogLevel.INFO, 'Test server stopped');
        }

        this.initialized = false;
        this.logger.log(LogLevel.INFO, 'Alfafrens plugin shutdown complete');
    }

    /**
     * Execute an intent
     */
    public async execute(intent: Intent, context: RequestContext): Promise<PluginResult> {
        if (!this.initialized) {
            return {
                success: false,
                error: 'Alfafrens plugin is not initialized'
            };
        }

        switch (intent.action) {
            case 'alfafrens:getMessages':
                return this.handleGetMessages(intent.data, context);

            case 'alfafrens:sendMessage':
                return this.handleSendMessage(intent.data, context);

            case 'alfafrens:replyMessage':
                return this.handleReplyMessage(intent.data, context);

            case 'alfafrens:createPost':
                return this.handleCreatePost(intent.data, context);

            case 'alfafrens:startPolling':
                return this.handleStartPolling(intent.data, context);

            case 'alfafrens:stopPolling':
                return this.handleStopPolling(context);

            case 'alfafrens:testAI':
                return this.handleTestAI(intent.data, context);

            default:
                return {
                    success: false,
                    error: `Unsupported intent action: ${intent.action}`
                };
        }
    }

    /**
     * Handle getMessages intent
     */
    private async handleGetMessages(data: any, context: RequestContext): Promise<PluginResult> {
        try {
            const options = {
                since: data?.since,
                until: data?.until,
                includeReactions: data?.includeReactions,
                includeReplies: data?.includeReplies
            };

            const messages = await this.api.getMessages(options);

            // Store messages in memory system
            if (messages.length > 0) {
                await this.storeMessagesInMemory(messages, context.userId);
            }

            return {
                success: true,
                data: {
                    messages,
                    count: messages.length
                }
            };
        } catch (error: any) {
            return {
                success: false,
                error: `Failed to get messages: ${error.message}`
            };
        }
    }

    /**
     * Handle sendMessage intent
     */
    private async handleSendMessage(data: any, context: RequestContext): Promise<PluginResult> {
        if (!data || !data.content) {
            return {
                success: false,
                error: 'Missing required content in intent data'
            };
        }

        try {
            // Apply character traits to the message
            const applyTraitsIntent = new Intent('character:apply', {
                characterId: this.characterId,
                content: data.content,
                options: {
                    context: TraitContext.CHAT
                },
                sessionId: this.config.channelId
            });
            const result = await this.mcp.executeIntent(applyTraitsIntent);
            const personalizedContent = result.data.content;

            const response = await this.api.sendMessage(personalizedContent);

            // Create a memory for the sent message
            const message = this.createMessageFromResponse(response, personalizedContent);
            await this.storeMessageInMemory(message, context.userId);

            return {
                success: true,
                data: {
                    messageId: response.messageId,
                    timestamp: response.timestamp
                }
            };
        } catch (error: any) {
            return {
                success: false,
                error: `Failed to send message: ${error.message}`
            };
        }
    }

    /**
     * Handle replyMessage intent
     */
    private async handleReplyMessage(data: any, context: RequestContext): Promise<PluginResult> {
        if (!data || !data.content || !data.replyTo) {
            return {
                success: false,
                error: 'Missing required content or replyTo in intent data'
            };
        }

        try {
            // Apply character traits to the reply
            const applyTraitsIntent = new Intent('character:apply', {
                characterId: this.characterId,
                content: data.content,
                options: {
                    context: TraitContext.CHAT
                },
                sessionId: this.config.channelId
            });
            const result = await this.mcp.executeIntent(applyTraitsIntent);
            const personalizedContent = result.data.content;

            const response = await this.api.replyMessage(personalizedContent, data.replyTo);

            // Create a memory for the sent reply
            const message = this.createMessageFromResponse(response, personalizedContent, data.replyTo);
            await this.storeMessageInMemory(message, context.userId);

            return {
                success: true,
                data: {
                    messageId: response.messageId,
                    timestamp: response.timestamp,
                    replyTo: data.replyTo
                }
            };
        } catch (error: any) {
            return {
                success: false,
                error: `Failed to reply to message: ${error.message}`
            };
        }
    }

    /**
     * Handle createPost intent
     */
    private async handleCreatePost(data: any, context: RequestContext): Promise<PluginResult> {
        if (!data || !data.content) {
            return {
                success: false,
                error: 'Missing required content in intent data'
            };
        }

        try {
            // Apply character traits to the post
            const applyTraitsIntent = new Intent('character:apply', {
                characterId: this.characterId,
                content: data.content,
                options: {
                    context: TraitContext.POST
                },
                sessionId: this.config.channelId
            });
            const result = await this.mcp.executeIntent(applyTraitsIntent);
            const personalizedContent = result.data.content;

            const response = await this.api.createPost(personalizedContent);

            // Create a memory for the created post
            const message = this.createMessageFromResponse(response, personalizedContent);
            await this.storeMessageInMemory(message, context.userId, 'post');

            return {
                success: true,
                data: {
                    messageId: response.messageId,
                    timestamp: response.timestamp
                }
            };
        } catch (error: any) {
            return {
                success: false,
                error: `Failed to create post: ${error.message}`
            };
        }
    }

    /**
     * Handle startPolling intent
     */
    private async handleStartPolling(data: any, context: RequestContext): Promise<PluginResult> {
        try {
            const interval = data?.interval || this.config.pollInterval;

            await this.startMessagePolling(interval);

            return {
                success: true,
                data: {
                    message: `Started polling messages every ${interval} seconds`,
                    interval
                }
            };
        } catch (error: any) {
            return {
                success: false,
                error: `Failed to start polling: ${error.message}`
            };
        }
    }

    /**
     * Handle stopPolling intent
     */
    private async handleStopPolling(context: RequestContext): Promise<PluginResult> {
        try {
            if (this.pollInterval) {
                clearInterval(this.pollInterval);
                this.pollInterval = undefined;
            }

            return {
                success: true,
                data: {
                    message: 'Stopped message polling'
                }
            };
        } catch (error: any) {
            return {
                success: false,
                error: `Failed to stop polling: ${error.message}`
            };
        }
    }

    /**
     * Start polling for new messages
     */
    private async startMessagePolling(intervalSeconds = this.config.pollInterval): Promise<void> {
        // Clear any existing interval
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }

        // Initialize last processed time if not set
        if (this.lastProcessedTime === 0) {
            this.lastProcessedTime = Date.now();
        }

        // First poll immediately
        await this.pollMessages();

        // Then set up interval
        this.pollInterval = setInterval(async () => {
            await this.pollMessages();
        }, intervalSeconds * 1000);

        this.logger.log(LogLevel.INFO, `Started polling messages every ${intervalSeconds} seconds`);
    }

    /**
     * Poll for new messages and store them
     */
    private async pollMessages(): Promise<void> {
        try {
            const currentTime = Date.now();

            // Get messages since last poll
            const messages = await this.api.getMessages({
                since: this.lastProcessedTime,
                includeReactions: true,
                includeReplies: true
            });

            // Update last processed time
            this.lastProcessedTime = currentTime;

            // Process and store new messages
            if (messages.length > 0) {
                this.logger.log(LogLevel.INFO, `Retrieved ${messages.length} new messages`);
                await this.storeMessagesInMemory(messages, this.config.userId);

                // Keep track of messages we've responded to in this polling cycle
                const respondedMessageIds = new Set<string>();

                // Respond to messages not sent by our bot
                for (const message of messages) {
                    // Skip messages from the bot itself
                    if (message.senderId === this.config.userId) {
                        continue;
                    }

                    // Skip messages that are replies to messages we already responded to in this cycle
                    // This prevents multiple responses to the same conversation thread
                    if (message.replyTo && respondedMessageIds.has(message.replyTo)) {
                        continue;
                    }

                    // Check if this message warrants a response
                    const isMentioned =
                        message.content.toLowerCase().includes(this.config.username.toLowerCase()) ||
                        message.content.includes('@' + this.config.username);

                    // Higher probability of responding to mentions
                    const responseProb = isMentioned ? 0.9 : 0.6;
                    const shouldRespond = isMentioned || Math.random() < responseProb;

                    if (shouldRespond) {
                        await this.generateAndSendResponse(message);
                        // Track that we've responded to this message
                        respondedMessageIds.add(message.id);
                    }
                }
            }
        } catch (error) {
            this.logger.log(LogLevel.ERROR, 'Error polling messages:', error);
        }
    }

    /**
     * Generate and send a response to a message
     */
    private async generateAndSendResponse(message: AlfaFrensMessage): Promise<void> {
        try {
            this.logger.log(LogLevel.INFO, `Generating response to message from ${message.senderUsername}`);

            // First, build context for the response
            const contextIntent = new Intent('context:build', {
                query: message.content,
                options: {
                    maxItems: 10,
                    includeTypes: ['message']
                }
            });

            const contextResult = await this.mcp.executeIntent(contextIntent);
            let contextItems = [];

            if (contextResult.success && contextResult.data.contextItems) {
                contextItems = contextResult.data.contextItems;
            }

            // Use reasoning for the response with better context and guidance
            const reasoningIntent = new Intent('reasoning:solve', {
                problem: `Generate a response to: "${message.content}"`,
                context: contextItems,
                options: {
                    // Determine if we should use chained reasoning based on message complexity
                    useChainedReasoning: this.shouldUseChainedReasoning(message.content),
                    maxIterations: 3,
                    maxDepth: message.content.length > 100 ? 3 : 1,
                    temperature: 0.7,
                    // Provide comprehensive guidance for the AI
                    systemContext: `You are responding as a helpful assistant in the Alfafrens community. 
                                   The user is ${message.senderUsername}. Provide a direct, helpful response
                                   that addresses their specific question without repeating their query back to them.
                                   
                                   Alfafrens is a Web3 platform with social and DeFi features including staking,
                                   governance, and community building. When responding to questions about 
                                   Alfafrens features like staking, governance, or community participation,
                                   be specific and informative.
                                   
                                   Always respond in a natural, conversational tone. Focus on providing 
                                   valuable information rather than asking for clarification unless absolutely necessary.`
                }
            });

            const reasoningResult = await this.mcp.executeIntent(reasoningIntent);
            let responseContent = "";

            if (reasoningResult.success && reasoningResult.data.solution) {
                responseContent = reasoningResult.data.solution;
            } else {
                // Generic failure message if reasoning fails
                responseContent = "I'm currently unable to process your request. Please try again later.";
                this.logger.log(LogLevel.ERROR, "Reasoning failed to generate response", reasoningResult);
            }

            // Apply character traits
            const applyTraitsIntent = new Intent('character:apply', {
                characterId: this.characterId,
                content: responseContent,
                options: {
                    context: TraitContext.CHAT
                }
            });

            const characterResult = await this.mcp.executeIntent(applyTraitsIntent);
            if (characterResult.success && characterResult.data.content) {
                responseContent = characterResult.data.content;
            }

            // Apply template formatting if available
            if (this.templateIntegration) {
                try {
                    // Determine template usage from message content
                    let templateUsage = 'standard';
                    if (message.content.toLowerCase().includes('hello') || message.content.toLowerCase().includes('hi')) {
                        templateUsage = 'greeting';
                    } else if (message.content.includes('?')) {
                        templateUsage = 'question';
                    } else if (message.content.length > 200) {
                        templateUsage = 'complex';
                    }

                    responseContent = await this.templateIntegration.formatResponse(
                        message,
                        responseContent,
                        templateUsage
                    );
                    this.logger.log(LogLevel.DEBUG, `Applied template formatting (${templateUsage})`);
                } catch (error) {
                    this.logger.log(LogLevel.ERROR, 'Failed to apply template formatting', error);
                }
            }

            // Send the response as a reply to the original message
            const replyIntent = new Intent('alfafrens:replyMessage', {
                content: responseContent,
                replyTo: message.id
            });

            await this.mcp.executeIntent(replyIntent);
            this.logger.log(LogLevel.INFO, `Sent auto-generated reply to ${message.senderUsername}`);
        } catch (error) {
            this.logger.log(LogLevel.ERROR, `Error generating response: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Schedule next automated post
     */
    private scheduleNextPost(): void {
        if (!this.config.enablePost) {
            return;
        }

        // Clear any existing timeout
        if (this.postInterval) {
            clearTimeout(this.postInterval);
        }

        // Calculate random interval within configured range
        const min = this.config.postIntervalMin * 1000;
        const max = this.config.postIntervalMax * 1000;
        const interval = Math.floor(Math.random() * (max - min + 1)) + min;

        this.postInterval = setTimeout(async () => {
            try {
                await this.createAutomatedPost();
            } finally {
                // Schedule next post regardless of success/failure
                this.scheduleNextPost();
            }
        }, interval);

        this.logger.log(LogLevel.INFO, `Scheduled next automated post in ${Math.floor(interval / 1000 / 60)} minutes`);
    }

    /**
     * Store messages in memory with enhanced processing using reasoning
     */
    private async storeMessagesInMemory(messages: AlfaFrensMessage[], userId: string): Promise<void> {
        // Log the number of messages being stored
        this.logger.log(LogLevel.DEBUG, `Storing ${messages.length} messages in memory`);

        // Process each message
        for (const message of messages) {
            await this.storeMessageInMemory(message, userId);
        }
    }

    /**
     * Store a single message in memory with enhanced processing
     */
    private async storeMessageInMemory(
        message: AlfaFrensMessage,
        userId: string,
        category = 'message'
    ): Promise<void> {
        try {
            // First, analyze the message content using reasoning
            const analysisIntent = new Intent('reasoning:analyze', {
                content: message.content,
                options: {
                    maxDepth: 2
                }
            });

            const analysisResult = await this.mcp.executeIntent(analysisIntent);

            let sentiment = 'neutral';
            let topics: string[] = [];
            let priority = 'normal';

            // Extract analysis results if successful
            if (analysisResult.success && analysisResult.data) {
                const analysis = analysisResult.data.conclusion || '';

                // Simple extraction of insights from analysis
                if (analysis.toLowerCase().includes('positive')) {
                    sentiment = 'positive';
                } else if (analysis.toLowerCase().includes('negative')) {
                    sentiment = 'negative';
                }

                // Extract topics (simplified approach)
                const topicMatch = analysis.match(/topics?:([^\.]+)/i);
                if (topicMatch && topicMatch[1]) {
                    topics = topicMatch[1].split(',').map((t: string) => t.trim());
                }

                // Determine priority
                if (analysis.toLowerCase().includes('urgent') ||
                    analysis.toLowerCase().includes('important')) {
                    priority = 'high';
                }
            }

            // Create relationships between sender and other entities if needed
            if (message.replyTo) {
                const relationshipIntent = new Intent('relationship:create', {
                    entityA: message.senderId,
                    entityB: message.replyTo,
                    type: 'replied_to',
                    status: 'active'
                });

                await this.mcp.executeIntent(relationshipIntent);
            }

            // Store the message in memory with enhanced metadata
            const memory: Memory = {
                userId: userId as UUID,
                roomId: this.config.channelId as UUID,
                type: MemoryType.MESSAGE,
                content: {
                    text: message.content,
                    sender: message.senderUsername,
                    timestamp: new Date(message.timestamp), // Convert string to Date
                    messageId: message.id,
                    replyTo: message.replyTo
                },
                metadata: {
                    source: 'alfafrens',
                    channelId: this.config.channelId,
                    senderId: message.senderId,
                    sentiment,
                    topics,
                    priority,
                    category,
                    reactions: message.reactions || []
                }
            };

            // Create the memory
            await this.memoryManager.createMemory(memory);

            this.logger.log(LogLevel.DEBUG, `Stored message ${message.id} from ${message.senderUsername}`);
        } catch (error) {
            this.logger.log(
                LogLevel.ERROR,
                `Error storing message in memory: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Create an automated post with reasoning assistance
     */
    private async createAutomatedPost(): Promise<void> {
        try {
            // Get context for generating the post
            const contextIntent = new Intent('context:build', {
                query: "What are the recent conversation topics?",
                options: {
                    maxItems: 20,
                    includeTypes: ['message', 'summary']
                }
            });

            const contextResult = await this.mcp.executeIntent(contextIntent);

            if (!contextResult.success || !contextResult.data.contextItems) {
                this.logger.log(LogLevel.WARN, "Failed to build context for automated post");
                return;
            }

            // Use reasoning to generate post content
            const reasoningIntent = new Intent('reasoning:solve', {
                problem: "Create an engaging social media post about the recent conversation topics.",
                options: {
                    maxDepth: 4,
                    methodOptions: {
                        context: contextResult.data.contextItems
                    }
                }
            });

            const reasoningResult = await this.mcp.executeIntent(reasoningIntent);

            if (!reasoningResult.success) {
                this.logger.log(LogLevel.WARN, "Failed to generate post content");
                return;
            }

            const postContent = reasoningResult.data.solution;

            // Apply character traits to the post
            const applyTraitsIntent = new Intent('character:apply', {
                characterId: this.characterId,
                content: postContent,
                options: {
                    context: TraitContext.POST
                },
                sessionId: this.config.channelId
            });
            const result = await this.mcp.executeIntent(applyTraitsIntent);
            const personalizedContent = result.data.content;

            // Send the post
            const response = await this.api.createPost(personalizedContent);

            // Store the post in memory
            const postMessage = this.createMessageFromResponse(response, personalizedContent);
            await this.storeMessageInMemory(postMessage, this.config.userId, 'automated_post');

            this.logger.log(LogLevel.INFO, `Created automated post: ${response.messageId}`);

            // Schedule the next post
            this.scheduleNextPost();
        } catch (error) {
            this.logger.log(
                LogLevel.ERROR,
                `Error creating automated post: ${error instanceof Error ? error.message : String(error)}`
            );

            // Still schedule the next post even if this one failed
            this.scheduleNextPost();
        }
    }

    /**
     * Create a message object from API response
     */
    private createMessageFromResponse(
        response: AlfaFrensSendMessageResponse,
        content: string,
        replyTo?: string
    ): AlfaFrensMessage {
        return {
            id: response.messageId,
            senderId: this.config.userId,
            senderUsername: this.config.username,
            content: content,
            timestamp: response.timestamp,
            replyTo: replyTo
        };
    }

    /**
     * Get the plugin's configuration file path
     */
    getConfigPath(): string {
        return join(this.pluginDirectory, 'plugin-config.json');
    }

    /**
     * Get the plugin's character definition file paths
     */
    getCharacterPaths(): string[] {
        return [join(this.pluginDirectory, 'characters', 'alfafrens-bot.json')];
    }

    /**
     * Get the plugin's directory path
     */
    getPluginDirectory(): string {
        return this.pluginDirectory;
    }

    /**
     * Determine if we should use chained reasoning based on message content
     */
    private shouldUseChainedReasoning(content: string): boolean {
        // Check content complexity
        const isComplex = content.length > 100;

        // Check if content likely requires deeper reasoning
        const complexTerms = [
            'explain', 'how', 'why', 'compare', 'difference',
            'stake', 'staking', 'governance', 'strategy'
        ];

        const hasComplexTerms = complexTerms.some(term =>
            content.toLowerCase().includes(term)
        );

        return isComplex || hasComplexTerms;
    }

    /**
     * Start the test server for the chat interface
     */
    private startTestServer(): void {
        this.testServer = http.createServer((req, res) => {
            // Set CORS headers
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

            // Handle preflight
            if (req.method === 'OPTIONS') {
                res.writeHead(200);
                res.end();
                return;
            }

            // Handle chat interface request
            if (req.url === '/' || req.url === '/chat') {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(this.getChatInterfaceHtml());
                return;
            }

            // Handle API endpoints
            if (req.url?.startsWith('/api/')) {
                this.handleApiRequest(req, res);
                return;
            }

            // Not found
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
        });

        this.testServer.listen(this.testServerConfig.port);
    }

    /**
     * Handle API requests for the test server
     */
    private handleApiRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
        const url = req.url || '';

        // Get messages endpoint
        if (url === '/api/messages' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(this.testMessages));
            return;
        }

        // Send message endpoint
        if (url === '/api/send' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });

            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    if (!data.content) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Content is required' }));
                        return;
                    }

                    // Create new message
                    const newMessage: TestMessage = {
                        id: Date.now().toString(),
                        senderId: 'test-user',
                        senderUsername: 'TestUser',
                        content: data.content,
                        timestamp: new Date().toISOString(),
                        replyTo: data.replyTo
                    };

                    this.testMessages.push(newMessage);

                    // Process message through the plugin system
                    this.processTestMessage(newMessage);

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        id: newMessage.id,
                        status: 'success'
                    }));
                } catch (error) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to process message' }));
                }
            });

            return;
        }

        // Not found
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'API endpoint not found' }));
    }

    /**
     * Process a test message as if it came from the Alfafrens API
     */
    private async processTestMessage(message: TestMessage): Promise<void> {
        try {
            // Only process messages from test users
            if (message.senderId === 'bot') {
                return;
            }

            // Generate and send a response
            await this.generateAndSendTestResponse(message);
        } catch (error) {
            this.logger.log(LogLevel.ERROR, `Error processing test message: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Generate and send a response to a test message
     */
    private async generateAndSendTestResponse(message: TestMessage): Promise<void> {
        try {
            this.logger.log(LogLevel.INFO, `Generating test response to message: ${message.content}`);

            // First, build context for the response
            const contextIntent = new Intent('context:build', {
                query: message.content,
                options: {
                    maxItems: 5,
                    includeTypes: ['message']
                }
            });

            const contextResult = await this.mcp.executeIntent(contextIntent);
            let contextItems = [];

            if (contextResult.success && contextResult.data.contextItems) {
                contextItems = contextResult.data.contextItems;
            }

            // Prepare reasoning intent with debug info
            const options = {
                useChainedReasoning: this.shouldUseChainedReasoning(message.content),
                maxIterations: 20,
                maxDepth: message.content.length > 100 ? 3 : 1,
                temperature: 0.7,
                systemContext: `You are responding as a helpful assistant in the Alfafrens community. 
                               The user is ${message.senderUsername}. Provide a direct, helpful response
                               that addresses their specific question without repeating their query back to them.
                               
                               Alfafrens is a Web3 platform with social and DeFi features including staking,
                               governance, and community building. When responding to questions about 
                               Alfafrens features like staking, governance, or community participation,
                               be specific and informative.
                               
                               Always respond in a natural, conversational tone.`
            };

            this.logger.log(LogLevel.INFO, `Using chained reasoning: ${options.useChainedReasoning}`);

            const reasoningIntent = new Intent('reasoning:solve', {
                problem: `Generate a response to: "${message.content}"`,
                context: contextItems,
                options: options
            });

            // Execute reasoning intent
            const reasoningResult = await this.mcp.executeIntent(reasoningIntent);
            this.logger.log(LogLevel.INFO, `Reasoning result status: ${reasoningResult.success}`);

            let responseContent = "";

            if (reasoningResult.success && reasoningResult.data.solution) {
                responseContent = reasoningResult.data.solution;

                // Log detailed info about the reasoning process
                if (reasoningResult.data.reasoning_chain) {
                    this.logger.log(LogLevel.INFO, `Reasoning iterations: ${reasoningResult.data.reasoning_chain.length}`);
                }
            } else {
                responseContent = "I'm currently unable to process your request. Please try again later.";
                this.logger.log(LogLevel.ERROR, "Reasoning failed to generate response", reasoningResult);
            }

            // Apply character traits
            const applyTraitsIntent = new Intent('character:apply', {
                characterId: this.characterId,
                content: responseContent,
                options: {
                    context: TraitContext.CHAT
                }
            });

            const characterResult = await this.mcp.executeIntent(applyTraitsIntent);
            if (characterResult.success && characterResult.data.content) {
                responseContent = characterResult.data.content;
            }

            // Create bot response
            const botResponse: TestMessage = {
                id: `bot-${Date.now().toString()}`,
                senderId: 'bot',
                senderUsername: this.config.username || 'AlfafrensBot',
                content: responseContent,
                timestamp: new Date().toISOString(),
                replyTo: message.id
            };

            // Add to messages
            this.testMessages.push(botResponse);

            this.logger.log(LogLevel.INFO, `Sent test response: ${responseContent.substring(0, 50)}...`);
        } catch (error) {
            this.logger.log(LogLevel.ERROR, `Error generating test response: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Get HTML for the chat interface
     */
    private getChatInterfaceHtml(): string {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Alfafrens Chat Test</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        .chat-container {
            border: 1px solid #ccc;
            border-radius: 5px;
            padding: 10px;
            height: 400px;
            overflow-y: auto;
            margin-bottom: 10px;
        }
        .message {
            margin-bottom: 10px;
            padding: 8px 12px;
            border-radius: 5px;
        }
        .user-message {
            background-color: #e1f5fe;
            margin-left: 20px;
            text-align: right;
        }
        .bot-message {
            background-color: #f1f1f1;
            margin-right: 20px;
        }
        .input-container {
            display: flex;
        }
        #message-input {
            flex-grow: 1;
            padding: 8px;
            border: 1px solid #ccc;
            border-radius: 4px;
            margin-right: 10px;
        }
        button {
            padding: 8px 16px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        .sender-info {
            font-size: 0.8em;
            color: #666;
            margin-bottom: 4px;
        }
        .status {
            margin-top: 10px;
            padding: 10px;
            background-color: #fffde7;
            border-radius: 4px;
            display: none;
        }
    </style>
</head>
<body>
    <h1>Alfafrens Chat Test</h1>
    <div class="chat-container" id="chat-container"></div>
    <div class="input-container">
        <input type="text" id="message-input" placeholder="Type your message here..." />
        <button id="send-button">Send</button>
    </div>
    <div class="status" id="status"></div>

    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const chatContainer = document.getElementById('chat-container');
            const messageInput = document.getElementById('message-input');
            const sendButton = document.getElementById('send-button');
            const status = document.getElementById('status');
            
            // Load initial messages
            fetchMessages();
            
            // Set up message polling
            setInterval(fetchMessages, 2000);
            
            // Handle send button click
            sendButton.addEventListener('click', sendMessage);
            
            // Handle enter key in input
            messageInput.addEventListener('keyup', (event) => {
                if (event.key === 'Enter') {
                    sendMessage();
                }
            });
            
            // Fetch messages from server
            function fetchMessages() {
                fetch('/api/messages')
                    .then(response => response.json())
                    .then(messages => {
                        renderMessages(messages);
                    })
                    .catch(error => {
                        showStatus('Error fetching messages: ' + error, true);
                    });
            }
            
            // Render messages in the chat container
            function renderMessages(messages) {
                // Get currently displayed message IDs
                const displayedMessages = new Set(
                    Array.from(chatContainer.querySelectorAll('.message'))
                        .map(el => el.dataset.id)
                );
                
                // Sort messages by timestamp
                messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                
                let hasNewMessages = false;
                
                // Add new messages
                messages.forEach(message => {
                    if (!displayedMessages.has(message.id)) {
                        const messageElement = document.createElement('div');
                        messageElement.classList.add('message');
                        messageElement.classList.add(message.senderId === 'bot' ? 'bot-message' : 'user-message');
                        messageElement.dataset.id = message.id;
                        
                        const senderInfo = document.createElement('div');
                        senderInfo.classList.add('sender-info');
                        senderInfo.textContent = message.senderUsername + ' • ' + 
                            new Date(message.timestamp).toLocaleTimeString();
                        
                        const content = document.createElement('div');
                        content.classList.add('content');
                        content.textContent = message.content;
                        
                        messageElement.appendChild(senderInfo);
                        messageElement.appendChild(content);
                        chatContainer.appendChild(messageElement);
                        
                        hasNewMessages = true;
                    }
                });
                
                // Scroll to bottom if there are new messages
                if (hasNewMessages) {
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                }
            }
            
            // Send a message to the server
            function sendMessage() {
                const content = messageInput.value.trim();
                if (!content) return;
                
                showStatus('Sending message...');
                
                fetch('/api/send', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ content })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.error) {
                        showStatus('Error: ' + data.error, true);
                    } else {
                        messageInput.value = '';
                        showStatus('Message sent!');
                        
                        // Add user message immediately for better UX
                        const userMessage = {
                            id: data.id,
                            senderId: 'test-user',
                            senderUsername: 'You',
                            content: content,
                            timestamp: new Date().toISOString()
                        };
                        
                        renderMessages([userMessage]);
                        
                        // Show "thinking" status
                        showStatus('Bot is thinking...');
                    }
                })
                .catch(error => {
                    showStatus('Error sending message: ' + error, true);
                });
            }
            
            // Show status message
            function showStatus(message, isError = false) {
                status.textContent = message;
                status.style.display = 'block';
                status.style.backgroundColor = isError ? '#ffebee' : '#fffde7';
                
                // Hide status after 5 seconds unless it's an error
                if (!isError) {
                    setTimeout(() => {
                        status.style.display = 'none';
                    }, 5000);
                }
            }
        });
    </script>
</body>
</html>
        `;
    }

    /**
     * Handle testAI intent - generates a response to a test message
     * without actually sending it to Alfafrens platform
     */
    private async handleTestAI(data: any, context: RequestContext): Promise<PluginResult> {
        try {
            const { message, username = 'TestUser' } = data || {};

            if (!message) {
                return {
                    success: false,
                    error: 'Message content is required'
                };
            }

            this.logger.log(LogLevel.INFO, `[TEST-AI] Processing request from ${username}: "${message}"`);
            console.log(`[TEST-AI] Starting processing for message: "${message}" from user: ${username}`);

            // Create a simulated message object
            const testMessage: AlfaFrensMessage = {
                id: `test-${Date.now()}`,
                senderId: 'test-user',
                senderUsername: username,
                content: message,
                timestamp: new Date().toISOString()
            };
            console.log(`[TEST-AI] Created test message object with ID: ${testMessage.id}`);

            // Generate a response using the same pipeline we use for real messages
            // First, build context for the response
            console.log(`[TEST-AI] Building context for message using context:build intent...`);
            const contextIntent = new Intent('context:build', {
                query: message,
                options: {
                    maxItems: 5,
                    includeTypes: ['message']
                }
            });

            console.log(`[TEST-AI] Executing context:build intent with query: "${message}"`);
            const contextResult = await this.mcp.executeIntent(contextIntent);
            console.log(`[TEST-AI] Context build result success: ${contextResult.success}`);
            let contextItems = [];

            if (contextResult.success && contextResult.data.contextItems) {
                contextItems = contextResult.data.contextItems;
                this.logger.log(LogLevel.DEBUG, `Generated context with ${contextItems.length} items`);
                console.log(`[TEST-AI] Generated ${contextItems.length} context items`);
                console.log(`[TEST-AI] Context items: ${JSON.stringify(contextItems.map((item: any) => ({ id: item.id, type: item.type })))}`);
            } else {
                console.log(`[TEST-AI] Failed to build context or no context items returned`);
            }

            // Use reasoning for the response
            console.log(`[TEST-AI] Preparing reasoning intent with problem: "Generate a response to: "${message}""`);
            const reasoningIntent = new Intent('reasoning:solve', {
                problem: `Generate a response to: "${message}"`,
                context: contextItems,
                options: {
                    useChainedReasoning: this.shouldUseChainedReasoning(message),
                    maxTokens: 800,
                    maxIterations: 20,
                    temperature: 0.7,
                    systemContext: `You are responding as a helpful assistant. 
                                   The user is ${username}. Provide a direct, helpful response
                                   that addresses their specific question.
                                   
                                   Always respond in a natural, conversational tone. Focus on providing 
                                   valuable information rather than asking for clarification unless absolutely necessary.`
                }
            });

            console.log(`[TEST-AI] Executing reasoning:solve intent with ${contextItems.length} context items`);
            console.log(`[TEST-AI] Reasoning with chain: ${this.shouldUseChainedReasoning(message)}`);
            const reasoningStart = Date.now();
            const reasoningResult = await this.mcp.executeIntent(reasoningIntent);
            const reasoningTime = Date.now() - reasoningStart;
            console.log(`[TEST-AI] Reasoning completed in ${reasoningTime}ms, success: ${reasoningResult.success}`);

            let responseContent = "";

            if (reasoningResult.success && reasoningResult.data.solution) {
                responseContent = reasoningResult.data.solution;
                console.log(`[TEST-AI] Generated raw response: "${responseContent.substring(0, 50)}..."`);
                this.logger.log(LogLevel.DEBUG, `Generated raw response with ${responseContent.length} characters`);
            } else {
                responseContent = "I'm currently unable to process your request. Please try again later.";
                console.log(`[TEST-AI] Reasoning failed: ${reasoningResult.error || 'Unknown error'}`);
                this.logger.log(LogLevel.ERROR, "Reasoning failed to generate test response", reasoningResult);

                return {
                    success: false,
                    error: 'Failed to generate AI response',
                    data: {
                        errorDetails: reasoningResult.error
                    }
                };
            }

            // Apply character traits
            if (this.characterId) {
                console.log(`[TEST-AI] Applying character traits using character ID: ${this.characterId}`);
                const applyTraitsIntent = new Intent('character:apply', {
                    characterId: this.characterId,
                    content: responseContent,
                    options: {
                        context: TraitContext.CHAT
                    }
                });

                const characterStart = Date.now();
                const characterResult = await this.mcp.executeIntent(applyTraitsIntent);
                const characterTime = Date.now() - characterStart;
                console.log(`[TEST-AI] Character traits applied in ${characterTime}ms, success: ${characterResult.success}`);

                if (characterResult.success && characterResult.data.content) {
                    console.log(`[TEST-AI] Original content length: ${responseContent.length}, New content length: ${characterResult.data.content.length}`);
                    responseContent = characterResult.data.content;
                    this.logger.log(LogLevel.DEBUG, `Applied character traits to response`);
                } else {
                    console.log(`[TEST-AI] Failed to apply character traits: ${characterResult.error || 'Unknown error'}`);
                }
            } else {
                console.log(`[TEST-AI] No character ID available, skipping character trait application`);
            }

            // Apply template formatting if available
            if (this.templateIntegration) {
                try {
                    console.log(`[TEST-AI] Applying template formatting to response`);

                    // Determine template usage from message content
                    let templateUsage = 'standard';
                    if (message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi')) {
                        templateUsage = 'greeting';
                    } else if (message.includes('?')) {
                        templateUsage = 'question';
                    } else if (message.length > 200) {
                        templateUsage = 'complex';
                    }

                    console.log(`[TEST-AI] Selected template usage: ${templateUsage}`);
                    const templateStart = Date.now();

                    responseContent = await this.templateIntegration.formatResponse(
                        testMessage,
                        responseContent,
                        templateUsage
                    );

                    const templateTime = Date.now() - templateStart;
                    console.log(`[TEST-AI] Template formatting applied in ${templateTime}ms`);
                    console.log(`[TEST-AI] Formatted response length: ${responseContent.length}`);
                    this.logger.log(LogLevel.DEBUG, `Applied template formatting (${templateUsage}) to test response`);
                } catch (error) {
                    console.log(`[TEST-AI] Failed to apply template formatting: ${error instanceof Error ? error.message : String(error)}`);
                    this.logger.log(LogLevel.ERROR, 'Failed to apply template formatting to test response', error);
                }
            } else {
                console.log(`[TEST-AI] No template integration available, skipping template formatting`);
            }

            // Create a simulated response message
            const responseMessage: AlfaFrensMessage = {
                id: `test-response-${Date.now()}`,
                senderId: this.config.userId,
                senderUsername: this.config.username,
                content: responseContent,
                timestamp: new Date().toISOString(),
                replyTo: testMessage.id
            };

            // Return the formatted response
            this.logger.log(LogLevel.INFO, `[TEST-AI] Generated test response with ${responseContent.length} characters`);
            console.log(`[TEST-AI] Final response: "${responseContent.substring(0, 50)}..."`);

            return {
                success: true,
                data: {
                    response: responseContent,
                    message: responseMessage,
                    originalMessage: testMessage,
                    metadata: {
                        reasoningTime,
                        contextItems: contextItems.length
                    }
                }
            };
        } catch (error) {
            this.logger.log(LogLevel.ERROR, 'Error processing test AI request', error);
            console.error(`[TEST-AI] Error: ${error instanceof Error ? error.message : String(error)}`);

            return {
                success: false,
                error: `Error generating test response: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
} 