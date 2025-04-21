/**
 * Structured Prompt Adapter for neucore
 * 
 * This module provides integration between the structured prompting system
 * and AI model providers through the Model Context Protocol (MCP).
 */

import { createPromptBuilder, PromptBuilder, StructuredPrompt } from './promptBuilder';
import { createTextPreprocessor, TextPreprocessor } from './textPreprocessor';

/**
 * Result from processing a structured prompt
 */
export interface StructuredPromptResult {
    /**
     * Response text from the AI model
     */
    response: string;

    /**
     * Metadata about the prompt and response
     */
    metadata: {
        /**
         * Time taken to process the request (ms)
         */
        processingTime: number;

        /**
         * Number of tokens used in the prompt
         */
        promptTokens: number;

        /**
         * Number of tokens in the response
         */
        responseTokens: number;

        /**
         * Total tokens used
         */
        totalTokens: number;

        /**
         * Model used for the response
         */
        model: string;
    };

    /**
     * The original structured prompt
     */
    originalPrompt: StructuredPrompt;
}

/**
 * Configuration options for the adapter
 */
export interface StructuredPromptAdapterOptions {
    /**
     * Default model to use
     */
    defaultModel?: string;

    /**
     * Default temperature (0-1)
     */
    defaultTemperature?: number;

    /**
     * Default max response tokens
     */
    defaultMaxTokens?: number;

    /**
     * Whether to log prompts for debugging
     */
    debug?: boolean;
}

/**
 * Model provider interface for interacting with AI models
 */
export interface ModelProvider {
    /**
     * Send a prompt to the model and get a response
     */
    sendPrompt(prompt: string, options?: any): Promise<{
        content: string;
        usage?: {
            promptTokens?: number;
            completionTokens?: number;
            totalTokens?: number;
        };
        model?: string;
    }>;
}

/**
 * Adapter for integrating structured prompts with model providers
 */
export class StructuredPromptAdapter {
    private promptBuilder: PromptBuilder;
    private textPreprocessor: TextPreprocessor;
    private modelProvider: ModelProvider;
    private options: StructuredPromptAdapterOptions;

    /**
     * Create a new structured prompt adapter
     * @param modelProvider Model provider to use
     * @param options Adapter options
     */
    constructor(modelProvider: ModelProvider, options: StructuredPromptAdapterOptions = {}) {
        this.modelProvider = modelProvider;
        this.options = {
            defaultModel: 'default',
            defaultTemperature: 0.7,
            defaultMaxTokens: 2000,
            debug: false,
            ...options
        };

        this.promptBuilder = createPromptBuilder();
        this.textPreprocessor = createTextPreprocessor();
    }

    /**
     * Process a user query with structured context
     * @param userQuery User query text
     * @param context Additional context information
     * @param modelOptions Options for the model
     * @returns AI response with metadata
     */
    async processQuery(
        userQuery: string,
        context: {
            customInstructions?: string;
            conversationSummary?: string;
            currentFiles?: any[];
            attachedFiles?: any[];
            linterErrors?: any[];
            terminalOutput?: string;
        } = {},
        modelOptions: {
            model?: string;
            temperature?: number;
            maxTokens?: number;
        } = {}
    ): Promise<StructuredPromptResult> {
        const startTime = Date.now();

        // Build the prompt
        const builder = this.createPromptBuilder(userQuery, context);
        const prompt = builder.build();
        const serializedPrompt = builder.serialize();

        // Log the prompt in debug mode
        if (this.options.debug) {
            console.debug('Structured Prompt:', serializedPrompt);
        }

        // Send to model provider
        const modelResponse = await this.modelProvider.sendPrompt(serializedPrompt, {
            model: modelOptions.model || this.options.defaultModel,
            temperature: modelOptions.temperature || this.options.defaultTemperature,
            maxTokens: modelOptions.maxTokens || this.options.defaultMaxTokens
        });

        // Calculate processing time
        const processingTime = Date.now() - startTime;

        // Create result
        return {
            response: modelResponse.content,
            metadata: {
                processingTime,
                promptTokens: modelResponse.usage?.promptTokens || 0,
                responseTokens: modelResponse.usage?.completionTokens || 0,
                totalTokens: modelResponse.usage?.totalTokens || 0,
                model: modelResponse.model || this.options.defaultModel || 'unknown'
            },
            originalPrompt: prompt
        };
    }

    /**
     * Create a prompt builder with the given context
     * @private
     */
    private createPromptBuilder(userQuery: string, context: any): PromptBuilder {
        const builder = this.promptBuilder;

        // Reset the builder (in case it was used before)
        const freshBuilder = createPromptBuilder();

        // Add user query
        freshBuilder.withUserQuery(userQuery);

        // Add custom instructions if provided
        if (context.customInstructions) {
            freshBuilder.withCustomInstructions(context.customInstructions);
        }

        // Add conversation summary if provided
        if (context.conversationSummary) {
            freshBuilder.withConversationSummary(context.conversationSummary);
        }

        // Add current files
        if (context.currentFiles && Array.isArray(context.currentFiles)) {
            for (const file of context.currentFiles) {
                freshBuilder.withCurrentFile(file);
            }
        }

        // Add attached files
        if (context.attachedFiles && Array.isArray(context.attachedFiles)) {
            for (const file of context.attachedFiles) {
                freshBuilder.withAttachedFile(file);
            }
        }

        // Add linter errors
        if (context.linterErrors && Array.isArray(context.linterErrors)) {
            freshBuilder.withLinterErrors(context.linterErrors);
        }

        // Add terminal output
        if (context.terminalOutput) {
            freshBuilder.withTerminalOutput(context.terminalOutput);
        }

        return freshBuilder;
    }

    /**
     * Process an existing structured prompt string
     * @param promptString Structured prompt string
     * @param modelOptions Options for the model
     * @returns AI response with metadata
     */
    async processStructuredPrompt(
        promptString: string,
        modelOptions: {
            model?: string;
            temperature?: number;
            maxTokens?: number;
        } = {}
    ): Promise<StructuredPromptResult> {
        const startTime = Date.now();

        // Parse the prompt to extract structure (for result metadata)
        const preprocessingResult = this.textPreprocessor.process(promptString);

        // Send to model provider
        const modelResponse = await this.modelProvider.sendPrompt(promptString, {
            model: modelOptions.model || this.options.defaultModel,
            temperature: modelOptions.temperature || this.options.defaultTemperature,
            maxTokens: modelOptions.maxTokens || this.options.defaultMaxTokens
        });

        // Calculate processing time
        const processingTime = Date.now() - startTime;

        // Reconstruct an approximation of the original structured prompt
        const userQuery = preprocessingResult.structuredData.tags?.user_query || '';
        const customInstructions = preprocessingResult.structuredData.tags?.custom_instructions;
        const conversationSummary = preprocessingResult.structuredData.tags?.conversation_summary;

        // Create minimal StructuredPrompt object
        const reconstructedPrompt: StructuredPrompt = {
            userQuery
        };

        if (customInstructions) {
            reconstructedPrompt.customInstructions = customInstructions;
        }

        if (conversationSummary) {
            reconstructedPrompt.conversationSummary = conversationSummary;
        }

        // Create result
        return {
            response: modelResponse.content,
            metadata: {
                processingTime,
                promptTokens: modelResponse.usage?.promptTokens || 0,
                responseTokens: modelResponse.usage?.completionTokens || 0,
                totalTokens: modelResponse.usage?.totalTokens || 0,
                model: modelResponse.model || this.options.defaultModel || 'unknown'
            },
            originalPrompt: reconstructedPrompt
        };
    }
}

/**
 * Factory function to create a structured prompt adapter
 */
export function createStructuredPromptAdapter(
    modelProvider: ModelProvider,
    options?: StructuredPromptAdapterOptions
): StructuredPromptAdapter {
    return new StructuredPromptAdapter(modelProvider, options);
} 