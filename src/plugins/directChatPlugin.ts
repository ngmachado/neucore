/**
 * Direct Chat Plugin for Neurocore
 * 
 * This plugin implements direct chat interactions for testing the framework without
 * connecting to external services.
 */

import { IPlugin, PluginResult, RequestContext } from '../mcp/interfaces/plugin';
import { Intent } from '../mcp/intent';
import { LogLevel } from '../types';
import { MCP } from '../mcp/mcp';
import * as path from 'path';
import { ReasoningMethod } from '../core/reasoning/types';

/**
 * DirectChat Plugin configuration
 */
interface DirectChatConfig {
    /** Character ID to use for responses */
    characterId?: string;
    /** Default character name if no ID is provided */
    defaultCharacterName?: string;
    /** Whether to use reasoning for complex queries */
    useReasoning?: boolean;
    /** Model to use for all operations */
    model?: string;
    context: {
        maxItems: number;
    };
    reasoning: {
        temperature: number;
        maxTokens: number;
        /** Reasoning method to use - defaults to 'socratic' */
        method?: string;
    };
}

/**
 * DirectChat Plugin implementation
 */
export class DirectChatPlugin implements IPlugin {
    private initialized: boolean = false;
    private config: DirectChatConfig;
    private logger: any;
    private mcp: MCP;
    private pluginDirectory: string;
    private sessions: Map<string, Array<{ role: string, content: string }>> = new Map();

    constructor(options: {
        logger: any;
        mcp: MCP;
        config?: Partial<DirectChatConfig>;
        pluginDirectory?: string;
    }) {
        this.logger = options.logger;
        this.mcp = options.mcp;
        this.pluginDirectory = options.pluginDirectory || path.join(__dirname, '..');

        // Default configuration with Socratic reasoning by default
        this.config = {
            characterId: undefined,
            defaultCharacterName: 'Assistant',
            useReasoning: true,
            model: options.config?.model || 'gpt-4o',
            context: {
                maxItems: 3
            },
            reasoning: {
                temperature: 0.8,
                maxTokens: 2000,
                method: 'socratic' // Default to Socratic reasoning
            },
            ...options.config
        };

        this.logger.log(LogLevel.INFO, `DirectChat Plugin created with config: ${JSON.stringify(this.config)}`);

        // Log the reasoning configuration specifically
        this.logger.log(LogLevel.INFO, `DirectChat using reasoning method: ${this.config.reasoning.method}`);
    }

    /**
     * Returns the list of intents this plugin supports
     */
    public supportedIntents(): string[] {
        return [
            'directChat:message'
        ];
    }

    /**
     * Returns the plugin directory path
     */
    public getPluginDirectory(): string {
        return this.pluginDirectory;
    }

    /**
     * Returns the config file path
     */
    public getConfigPath(): string {
        return path.join(this.pluginDirectory, 'plugins', 'directChat-config.json');
    }

    /**
     * Initialize the plugin
     */
    public async initialize(): Promise<void> {
        this.logger.log(LogLevel.INFO, 'Initializing DirectChat Plugin');

        try {
            // Try to load a character if one isn't specified
            if (!this.config.characterId) {
                try {
                    const loadIntent = new Intent('character:load', {
                        name: this.config.defaultCharacterName
                    });

                    const result = await this.mcp.executeIntent(loadIntent);
                    if (result.success && result.data?.characterId) {
                        this.config.characterId = result.data.characterId;
                        this.logger.log(LogLevel.INFO, `Loaded character with ID: ${this.config.characterId}`);
                    }
                } catch (error) {
                    this.logger.log(LogLevel.WARN, `Could not load default character: ${error}`);
                    // Continue without a character - will use basic response generation
                }
            }

            this.initialized = true;
            this.logger.log(LogLevel.INFO, 'DirectChat Plugin initialized successfully');
        } catch (error) {
            this.logger.log(LogLevel.ERROR, `Failed to initialize DirectChat Plugin: ${error}`);
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
                case 'directChat:message':
                    return await this.handleMessage(intent.data, context);
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
        this.logger.log(LogLevel.INFO, 'Shutting down DirectChat Plugin');
        this.initialized = false;
    }

    /**
     * Handle a message
     */
    private async handleMessage(data: any, context: RequestContext): Promise<PluginResult> {
        const { message, username = 'user', sessionId = username } = data;

        if (!message) {
            return {
                success: false,
                error: 'Missing message'
            };
        }

        try {
            this.logger.log(LogLevel.INFO, `Processing message from ${username} (session: ${sessionId}): ${message}`);
            this.logger.log(LogLevel.INFO, `Using reasoning method: ${this.config.reasoning.method}`);

            // Get or create conversation history
            let history = this.sessions.get(sessionId) || [];

            // Add the current message to history
            history.push({ role: 'user', content: message });

            // Limit history size to prevent excessive token usage
            if (history.length > 10) {
                history = history.slice(history.length - 10);
            }

            // First try to retrieve context for the message
            let contextItems: any[] = [];
            try {
                // Execute intent to query context directly
                const contextResponse = await this.mcp.executeIntent(new Intent({
                    action: 'context:build',
                    data: {
                        query: message,
                        options: {
                            maxItems: this.config.context.maxItems
                        }
                    }
                }));

                // If we have relevant context, prepare it for reasoning
                if (contextResponse.success && contextResponse.data?.contextItems?.length > 0) {
                    this.logger.info(`Found ${contextResponse.data.contextItems.length} context results`);

                    // Prepare context items for reasoning
                    contextItems = contextResponse.data.contextItems.map((item: any) => ({
                        content: { text: item.content?.text || JSON.stringify(item.content) },
                        type: item.type || 'context'
                    }));
                } else {
                    this.logger.info('No context results found, continuing with reasoning without context');
                }
            } catch (error) {
                this.logger.warn(`Error retrieving context: ${error}, continuing without context`);
            }

            // Add conversation history as additional context
            if (history.length > 1) {
                contextItems.push({
                    content: { text: JSON.stringify(history.slice(0, -1)) },
                    type: 'conversation_history'
                });
            }

            // Always use reasoning, with or without context
            try {
                // Prioritize reasoning method from intent, then context, then config
                const intentReasoningMethod = data?.reasoningMethod;
                const contextReasoningMethod = context.reasoningMethod;
                const configReasoningMethod = this.config.reasoning?.method;

                // Use the first defined method in order of precedence
                const reasoningMethod = intentReasoningMethod || contextReasoningMethod || configReasoningMethod || 'socratic';

                this.logger.info(`Intent data reasoning method: ${intentReasoningMethod}`);
                this.logger.info(`Context reasoning method: ${contextReasoningMethod}`);
                this.logger.info(`Config reasoning method: ${configReasoningMethod}`);
                this.logger.info(`Final reasoning method: ${reasoningMethod}`);

                this.logger.info(`Using reasoning method: ${reasoningMethod}`);
                this.logger.info(`Reasoning method type: ${typeof reasoningMethod}`);
                this.logger.info(`Is equal to 'socratic' string: ${reasoningMethod === 'socratic'}`);

                // Create reasoning intent with appropriate methodOptions for Socratic reasoning
                const reasoningIntent = new Intent({
                    action: 'reasoning:solve',
                    data: {
                        problem: `Generate a response to: "${message}"`,
                        context: contextItems,
                        options: {
                            model: this.config.model,
                            temperature: this.config.reasoning.temperature,
                            maxTokens: this.config.reasoning.maxTokens,
                            method: reasoningMethod,
                            methodOptions: (reasoningMethod === 'socratic') ? {
                                // Socratic-specific options
                                minQuestions: 3,
                                maxQuestions: 5,
                                includeVerification: true,
                                includeSynthesis: true,
                                // Add instruction to avoid mentioning reasoning method
                                systemInstructions: "Provide a thoughtful response that directly addresses the user's query. Do NOT mention or refer to the reasoning method or process used to generate your response (such as 'Socratic questioning' or any other reasoning technique). Focus entirely on delivering valuable content to the user without meta-commentary about how you arrived at your answer.",
                                // This makes the reasoner consider alternate perspectives
                                seedQuestions: [
                                    "What are the key assumptions behind this query?",
                                    "What alternative perspectives should I consider?",
                                    "What are potential limitations in my understanding of this topic?",
                                    "What evidence would support a different conclusion?"
                                ]
                            } : {
                                // Add same instruction for other reasoning methods
                                systemInstructions: "Provide a thoughtful response that directly addresses the user's query. Do NOT mention or refer to the reasoning method or process used to generate your response. Focus entirely on delivering valuable content to the user without meta-commentary about how you arrived at your answer."
                            }
                        }
                    }
                });

                // Log full intent data
                this.logger.info(`FULL REASONING INTENT: ${JSON.stringify(reasoningIntent)}`);
                this.logger.info(`REASONING METHOD IN INTENT: ${JSON.stringify(reasoningIntent.data.options.method)}`);

                // Execute reasoning intent
                const reasoningResponse = await this.mcp.executeIntent(reasoningIntent);

                if (reasoningResponse.success) {
                    let response = reasoningResponse.data.solution ||
                        reasoningResponse.data.response ||
                        "I processed your query but couldn't generate a detailed response.";

                    // Apply character styling if a character ID is configured
                    if (this.config.characterId) {
                        try {
                            this.logger.info(`Applying character ${this.config.characterId} to response`);

                            // Apply character traits to the response content
                            const characterResponse = await this.mcp.executeIntent(new Intent({
                                action: 'character:apply',
                                data: {
                                    characterId: this.config.characterId,
                                    content: response,
                                    options: {
                                        context: 'chat',
                                        traitTypes: ['personality', 'style']
                                    },
                                    sessionId: context.requestId || 'default-session'
                                }
                            }));

                            if (characterResponse.success && characterResponse.data?.content) {
                                this.logger.info('Successfully applied character traits to response');
                                response = characterResponse.data.content;
                            } else {
                                this.logger.warn(`Failed to apply character: ${characterResponse.error}`);
                            }
                        } catch (error) {
                            this.logger.warn(`Error applying character: ${error}`);
                            // Continue with the unmodified response
                        }
                    }

                    // Save the response to conversation history
                    history.push({ role: 'assistant', content: response });
                    this.sessions.set(sessionId, history);

                    return {
                        success: true,
                        data: {
                            response: response,
                            metadata: {
                                method: 'reasoning',
                                hasContext: contextItems.length > 0,
                                usedCharacter: this.config.characterId ? true : false,
                                characterId: this.config.characterId,
                                historyLength: history.length
                            }
                        }
                    };
                }
            } catch (error) {
                this.logger.error(`Error using reasoning: ${error}`);
                // Continue to fallback response
            }

            // Default response if reasoning failed
            const fallbackResponse = `I received your message: "${message}". This is a basic response from the DirectChat plugin.`;

            // Still save fallback responses to history
            history.push({ role: 'assistant', content: fallbackResponse });
            this.sessions.set(sessionId, history);

            return {
                success: true,
                data: {
                    response: fallbackResponse,
                    metadata: {
                        method: 'basic',
                        historyLength: history.length
                    }
                }
            };
        } catch (error) {
            this.logger.log(LogLevel.ERROR, `Error handling message: ${error}`);
            return {
                success: false,
                error: `Error: ${error}`
            };
        }
    }

    /**
     * Determine if reasoning should be used for the message
     */
    private shouldUseReasoning(message: string): boolean {
        // If message is longer than 20 characters or contains a question mark, use reasoning
        return message.length > 20 || message.includes('?');
    }
} 