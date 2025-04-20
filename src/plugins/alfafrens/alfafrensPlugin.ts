/**
 * Alfafrens Plugin for Neurocore
 * 
 * This plugin implements the integration with Alfafrens API service,
 * allowing for message retrieval, sending, and posting.
 */

import { IPlugin, PluginResult, RequestContext } from '../../mcp/interfaces/plugin';
import { Intent } from '../../mcp/intent';
import { UUID } from '../../types';
import { Memory, MemoryType } from '../../core/memory/types';
import { LogLevel, TraitContext } from '../../types';
import { MCP } from '../../mcp/mcp';
import { join, dirname } from 'path';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { TemplateIntegration } from './templateIntegration';
import { v4 as generateUUID } from 'uuid';

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
        this.baseUrl = baseUrl || process.env.ALFAFRENS_API_URL || "https://friendx-git-ai-api.preview.superfluid.finance";
    }

    private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
        const response = await fetch(`${this.baseUrl}${path}`, {
            ...options,
            headers: {
                "x-api-key": this.apiKey,
                "Content-Type": "application/json",
                ...options.headers
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API request failed: ${response.statusText}`);
        }

        const data = await response.json();
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

            // The API returns an array directly
            return await this.fetch<AlfaFrensMessage[]>(url);
        } catch (error) {
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
     * Implementation of message sending with options
     */
    private async sendMessageWithOptions(content: string, replyTo?: string): Promise<AlfaFrensSendMessageResponse> {
        const payload: any = {
            content,
            channelId: this.channelId
        };

        // Add reply option if provided
        if (replyTo) {
            payload.replyTo = replyTo;
        }

        const response = await this.fetch<AlfaFrensSendMessageResponse>('/api/ai/sendMessage', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        return response;
    }
}

/**
 * Alfafrens Plugin implementation
 */
export class AlfafrensPlugin implements IPlugin {
    // Singleton instance
    private static instance: AlfafrensPlugin | null = null;

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
        port: 3001,
        enabled: false
    };
    private templateIntegration: TemplateIntegration | null = null;

    /**
     * Get the singleton instance of AlfafrensPlugin
     * @param options Configuration options (only used when creating the instance)
     * @returns The singleton instance
     */
    public static getInstance(options?: {
        memoryManager: any;
        logger: any;
        mcp: MCP;
        config?: Partial<AlfaFrensConfig>;
        pluginDirectory?: string;
    }): AlfafrensPlugin {
        if (!AlfafrensPlugin.instance) {
            if (!options) {
                throw new Error('AlfafrensPlugin must be initialized with options');
            }
            AlfafrensPlugin.instance = new AlfafrensPlugin(options);
        } else if (options) {
            // If options are provided but instance already exists, log a warning
            if (options.logger) {
                options.logger.log(LogLevel.WARN, 'AlfafrensPlugin instance already exists, ignoring new options');
            } else {
                console.warn('AlfafrensPlugin instance already exists, ignoring new options');
            }
        }
        return AlfafrensPlugin.instance;
    }

    constructor(options: {
        memoryManager: any;
        logger: any;
        mcp: MCP; // Added MCP as a required dependency
        config?: Partial<AlfaFrensConfig>;
        pluginDirectory?: string;
    }) {
        // Enforce singleton pattern
        if (AlfafrensPlugin.instance) {
            const message = 'AlfafrensPlugin is a singleton. Use getInstance() instead of new constructor.';
            if (options.logger) {
                options.logger.log(LogLevel.ERROR, message);
            } else {
                console.error(message);
            }
            throw new Error(message);
        }

        this.memoryManager = options.memoryManager;
        this.logger = options.logger;
        this.mcp = options.mcp; // Store MCP reference
        this.pluginDirectory = options.pluginDirectory || path.join(__dirname, '../..');

        // Default configuration
        this.config = {
            apiKey: process.env.ALFAFRENS_API_KEY || '',
            userId: process.env.ALFAFRENS_USER_ID || '',
            channelId: process.env.ALFAFRENS_CHANNEL_ID || '',
            username: process.env.ALFAFRENS_USERNAME || 'Alfafrens Bot',
            pollInterval: 30, // seconds
            enablePost: false,
            postIntervalMin: 3600, // seconds (1 hour)
            postIntervalMax: 7200, // seconds (2 hours)
            testServer: this.testServerConfig
        };

        // Override with provided config
        if (options.config) {
            this.config = {
                ...this.config,
                ...options.config
            };

            // Specific test server overrides
            if (options.config.testServer) {
                this.testServerConfig = {
                    ...this.testServerConfig,
                    ...options.config.testServer
                };
                this.config.testServer = this.testServerConfig;
            }
        }

        // Initialize API client
        this.api = new AlfaFrensApi(
            this.config.apiKey,
            this.config.channelId
        );

        this.logger.log(LogLevel.INFO, `Alfafrens Plugin created with config: ${JSON.stringify({
            ...this.config,
            apiKey: '***' // Mask API key for security
        })}`);

        // Set the static instance
        AlfafrensPlugin.instance = this;
    }

    /**
     * Returns the list of intents this plugin supports
     */
    public supportedIntents(): string[] {
        return [
            'alfafrens:getMessages',
            'alfafrens:sendMessage',
            'alfafrens:replyMessage',
            'alfafrens:createPost',
            'alfafrens:startPolling',
            'alfafrens:stopPolling'
        ];
    }

    /**
     * Returns the plugin directory path
     * 
     * @returns The plugin directory path
     */
    public getPluginDirectory(): string {
        return this.pluginDirectory;
    }

    /**
     * Returns the config file path
     * 
     * @returns The config file path
     */
    public getConfigPath(): string {
        // Use a hard-coded absolute path to the config file
        return '/Users/logic/projects/neurocore/src/plugins/alfafrens-bot.json';
    }

    /**
     * Returns character definition file paths
     * 
     * @returns Array of character definition file paths
     */
    public getCharacterPaths(): string[] {
        return [
            '/Users/logic/projects/neurocore/src/plugins/alfafrens/alfafrens-faq.md'
        ];
    }

    /**
     * Initialize the plugin
     */
    public async initialize(): Promise<void> {
        this.logger.log(LogLevel.INFO, 'Initializing Alfafrens Plugin');

        try {
            // Load template integration
            this.templateIntegration = new TemplateIntegration({
                mcp: this.mcp,
                logger: this.logger,
                botConfig: this.config
            });

            this.initialized = true;
            this.logger.log(LogLevel.INFO, 'Alfafrens Plugin initialized successfully');
        } catch (error) {
            this.logger.log(LogLevel.ERROR, `Failed to initialize Alfafrens Plugin: ${error}`);
            throw error;
        }
    }

    /**
     * Execute an intent
     */
    public async execute(intent: Intent, context: RequestContext): Promise<PluginResult> {
        if (!this.initialized) {
            this.logger.log(LogLevel.ERROR, 'Cannot execute intent: Plugin not initialized');
            return {
                success: false,
                error: 'Plugin not initialized'
            };
        }

        this.logger.log(LogLevel.INFO, `Executing intent: ${intent.action}`);

        try {
            // Handle different intents
            switch (intent.action) {
                case 'alfafrens:getMessages':
                    return await this.handleGetMessages(intent.data, context);
                case 'alfafrens:sendMessage':
                    return await this.handleSendMessage(intent.data, context);
                case 'alfafrens:replyMessage':
                    return await this.handleReplyMessage(intent.data, context);
                case 'alfafrens:createPost':
                    return await this.handleCreatePost(intent.data, context);
                case 'alfafrens:startPolling':
                    return await this.handleStartPolling(intent.data, context);
                case 'alfafrens:stopPolling':
                    return await this.handleStopPolling(context);
                default:
                    this.logger.log(LogLevel.ERROR, `Unsupported intent: ${intent.action}`);
                    return {
                        success: false,
                        error: `Unsupported intent: ${intent.action}`
                    };
            }
        } catch (error) {
            this.logger.log(LogLevel.ERROR, `Error executing intent ${intent.action}: ${error}`);
            return {
                success: false,
                error: `Error: ${error}`
            };
        }
    }

    /**
     * Shutdown the plugin
     */
    public async shutdown(): Promise<void> {
        this.logger.log(LogLevel.INFO, 'Shutting down Alfafrens Plugin');

        try {
            // Stop polling
            if (this.pollInterval) {
                clearInterval(this.pollInterval);
                this.pollInterval = undefined;
            }

            // Stop automated posting
            if (this.postInterval) {
                clearTimeout(this.postInterval);
                this.postInterval = undefined;
            }

            // Shut down test server if running
            if (this.testServer) {
                this.testServer.close();
                this.testServer = null;
            }

            this.initialized = false;
            this.logger.log(LogLevel.INFO, 'Alfafrens Plugin shut down successfully');
        } catch (error) {
            this.logger.log(LogLevel.ERROR, `Error shutting down plugin: ${error}`);
            throw error;
        }
    }

    // Placeholder for required methods to make TypeScript happy
    private async handleGetMessages(data: any, context: RequestContext): Promise<PluginResult> {
        return { success: true, data: [] };
    }

    private async handleSendMessage(data: any, context: RequestContext): Promise<PluginResult> {
        return { success: true };
    }

    private async handleReplyMessage(data: any, context: RequestContext): Promise<PluginResult> {
        return { success: true };
    }

    private async handleCreatePost(data: any, context: RequestContext): Promise<PluginResult> {
        return { success: true };
    }

    private async handleStartPolling(data: any, context: RequestContext): Promise<PluginResult> {
        try {
            const interval = data?.interval || this.config.pollInterval || 30;
            this.logger.log(LogLevel.INFO, `Starting message polling with interval of ${interval} seconds`);

            // Clear any existing polling interval
            if (this.pollInterval) {
                clearInterval(this.pollInterval);
                this.pollInterval = undefined;
            }

            // Set up polling interval
            this.pollInterval = setInterval(async () => {
                try {
                    this.logger.log(LogLevel.DEBUG, "Polling for new messages...");

                    // Get messages since last check
                    const messages = await this.api.getMessages({
                        since: this.lastProcessedTime || (Date.now() - 3600000),
                        includeReactions: true,
                        includeReplies: true
                    });

                    if (messages && messages.length > 0) {
                        this.logger.log(LogLevel.INFO, `Found ${messages.length} new messages`);

                        // Process each message
                        for (const message of messages) {
                            // Skip messages from the bot itself to avoid loops
                            if (message.senderId === this.config.userId) {
                                continue;
                            }

                            // Simple logging for now
                            this.logger.log(LogLevel.INFO, `Processing message from ${message.senderUsername}: ${message.content.substring(0, 50)}...`);

                            // Keep the connection alive
                            // In a real implementation, you would have more sophisticated message processing here
                        }
                    }

                    // Update last processed time
                    this.lastProcessedTime = Date.now();
                } catch (error) {
                    this.logger.log(LogLevel.ERROR, `Error during message polling: ${error}`);
                }
            }, interval * 1000);

            return {
                success: true,
                data: {
                    message: `Polling started with interval: ${interval} seconds`,
                    interval: interval
                }
            };
        } catch (error) {
            this.logger.log(LogLevel.ERROR, `Failed to start polling: ${error}`);
            return {
                success: false,
                error: `Failed to start polling: ${error}`
            };
        }
    }

    private async handleStopPolling(context: RequestContext): Promise<PluginResult> {
        try {
            if (this.pollInterval) {
                this.logger.log(LogLevel.INFO, 'Stopping message polling');
                clearInterval(this.pollInterval);
                this.pollInterval = undefined;
                return {
                    success: true,
                    data: { message: 'Polling stopped successfully' }
                };
            } else {
                this.logger.log(LogLevel.WARN, 'No active polling to stop');
                return {
                    success: true,
                    data: { message: 'No active polling to stop' }
                };
            }
        } catch (error) {
            this.logger.log(LogLevel.ERROR, `Failed to stop polling: ${error}`);
            return {
                success: false,
                error: `Failed to stop polling: ${error}`
            };
        }
    }

    /**
     * Gets a namespace for a user, creating one if it doesn't exist
     */
    private async getUserNamespace(userId: string): Promise<string> {
        // Check if plugin is initialized before proceeding
        if (!this.initialized) {
            this.logger.log(LogLevel.ERROR, 'Cannot get user namespace: Plugin not initialized');
            throw new Error('Plugin not initialized');
        }

        if (!userId || typeof userId !== 'string' || userId.trim() === '') {
            this.logger.log(LogLevel.ERROR, `Invalid userId provided: ${userId}`);
            throw new Error('Invalid userId');
        }

        // Generate a unique transaction ID to log and track this operation
        const transactionId = generateUUID().substring(0, 8);
        this.logger.log(LogLevel.INFO, `[${transactionId}] Starting getUserNamespace transaction for user ${userId}`);

        try {
            // Use a transaction to ensure atomicity
            const beginTransactionIntent = new Intent('database:execute', {
                query: 'BEGIN TRANSACTION'
            });
            await this.mcp.executeIntent(beginTransactionIntent);
            this.logger.log(LogLevel.DEBUG, `[${transactionId}] Transaction started`);

            // Check if user has existing namespace with a timeout to prevent long-running transactions
            const checkIntent = new Intent('database:execute', {
                query: 'SELECT namespace_id FROM namespace_members WHERE entity_id = ? AND role = ? LIMIT 1',
                params: [userId, 'active'],
                timeout: 5000 // 5 second timeout
            });

            const result = await this.mcp.executeIntent(checkIntent);
            this.logger.log(LogLevel.DEBUG, `[${transactionId}] Namespace query executed`);

            // Check for explicit errors in the result
            if (!result.success) {
                throw new Error(`Database query failed: ${result.error || 'Unknown error'}`);
            }

            if (result.data?.rows?.length > 0) {
                // Commit transaction since we're just reading
                const commitTransactionIntent = new Intent('database:execute', {
                    query: 'COMMIT'
                });
                await this.mcp.executeIntent(commitTransactionIntent);

                const namespaceId = result.data.rows[0].namespace_id;
                this.logger.log(LogLevel.INFO, `[${transactionId}] Found existing namespace ${namespaceId} for user ${userId}`);
                return namespaceId;
            }

            // Create new namespace if none exists
            const namespaceId = generateUUID();
            this.logger.log(LogLevel.INFO, `[${transactionId}] Creating new namespace ${namespaceId} for user ${userId}`);

            // First, check if entity exists
            const checkEntityIntent = new Intent('database:execute', {
                query: 'SELECT id FROM entities WHERE id = ? LIMIT 1',
                params: [userId],
                timeout: 5000
            });

            const entityResult = await this.mcp.executeIntent(checkEntityIntent);

            // Check for explicit errors in entity query result
            if (!entityResult.success) {
                throw new Error(`Entity query failed: ${entityResult.error || 'Unknown error'}`);
            }

            // Create entity if it doesn't exist
            if (entityResult.data?.rows?.length === 0) {
                this.logger.log(LogLevel.INFO, `[${transactionId}] Creating new entity for user ${userId}`);
                const createEntityIntent = new Intent('database:execute', {
                    query: 'INSERT INTO entities (id, type, content, name, created_at) VALUES (?, ?, ?, ?, ?)',
                    params: [
                        userId,
                        'user',
                        JSON.stringify({ userId: userId }),
                        'User ' + userId.substring(0, 8),
                        new Date().toISOString()
                    ],
                    timeout: 5000
                });

                const createEntityResult = await this.mcp.executeIntent(createEntityIntent);
                // Check for explicit errors in entity creation
                if (!createEntityResult.success) {
                    throw new Error(`Entity creation failed: ${createEntityResult.error || 'Unknown error'}`);
                }

                this.logger.log(LogLevel.INFO, `[${transactionId}] Created new entity for user: ${userId}`);
            }

            // Now create namespace
            const createNamespaceIntent = new Intent('database:execute', {
                query: 'INSERT INTO namespaces (id, name, description, created_at) VALUES (?, ?, ?, ?)',
                params: [
                    namespaceId,
                    'User ' + userId.substring(0, 8),
                    'Namespace for user ' + userId.substring(0, 8),
                    new Date().toISOString()
                ],
                timeout: 5000
            });

            const namespaceResult = await this.mcp.executeIntent(createNamespaceIntent);
            // Check for explicit errors in namespace creation
            if (!namespaceResult.success) {
                throw new Error(`Namespace creation failed: ${namespaceResult.error || 'Unknown error'}`);
            }

            this.logger.log(LogLevel.INFO, `[${transactionId}] Created new namespace: ${namespaceId}`);

            // Add user as a member of namespace
            const memberIntent = new Intent('database:execute', {
                query: 'INSERT INTO namespace_members (id, namespace_id, entity_id, role, created_at) VALUES (?, ?, ?, ?, ?)',
                params: [
                    generateUUID(),
                    namespaceId,
                    userId,
                    'active',
                    new Date().toISOString()
                ],
                timeout: 5000
            });

            const memberResult = await this.mcp.executeIntent(memberIntent);
            // Check for explicit errors in member addition
            if (!memberResult.success) {
                throw new Error(`Failed to add user to namespace: ${memberResult.error || 'Unknown error'}`);
            }

            this.logger.log(LogLevel.INFO, `[${transactionId}] Added user ${userId} to namespace ${namespaceId}`);

            // Commit the transaction
            const commitIntent = new Intent('database:execute', {
                query: 'COMMIT'
            });
            await this.mcp.executeIntent(commitIntent);
            this.logger.log(LogLevel.INFO, `[${transactionId}] Transaction committed successfully`);

            return namespaceId;
        } catch (error) {
            // Roll back transaction on error
            try {
                this.logger.log(LogLevel.ERROR, `[${transactionId}] Error in transaction: ${error}`);
                const rollbackIntent = new Intent('database:execute', {
                    query: 'ROLLBACK'
                });
                await this.mcp.executeIntent(rollbackIntent);
                this.logger.log(LogLevel.INFO, `[${transactionId}] Transaction rolled back due to error`);
            } catch (rollbackError) {
                this.logger.log(LogLevel.ERROR, `[${transactionId}] Failed to rollback transaction: ${rollbackError}`);
            }

            // Detailed error logging
            this.logger.log(LogLevel.ERROR, `[${transactionId}] Failed to get/create user namespace: ${error}`);
            if (error instanceof Error) {
                this.logger.log(LogLevel.ERROR, `[${transactionId}] Error details: ${error.message}`);
                this.logger.log(LogLevel.ERROR, `[${transactionId}] Error stack: ${error.stack}`);
            }

            // Log context info to help with debugging
            this.logger.log(LogLevel.ERROR, `[${transactionId}] Context: userId=${userId}, plugin initialization status=${this.initialized}`);

            // Rethrow for proper error handling upstream
            throw error;
        }
    }
} 