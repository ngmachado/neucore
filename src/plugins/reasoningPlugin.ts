import { IPlugin, PluginResult, RequestContext } from '../mcp/interfaces/plugin';
import { Intent } from '../mcp/intent';
import { UUID } from '../types';
import { ProviderFactory } from '../core/providers';
import { IModelProvider, CompletionParams } from '../core/providers/modelProvider';

/**
 * Options for solving reasoning problems
 */
interface ReasoningOptions {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    useChainedReasoning?: boolean;
    systemContext?: string;
    maxDepth?: number;
    maxIterations?: number;
}

/**
 * Context item for reasoning
 */
interface ContextItem {
    id?: string;
    type?: string;
    content?: {
        text?: string;
        [key: string]: any;
    };
    metadata?: Record<string, any>;
    relevance?: number;
}

/**
 * Result metadata for reasoning
 */
interface ReasoningMetadata {
    model: string;
    approach: string;
    wordCount?: number;
    timestamp: string;
    reasoning_chain?: any[];
}

/**
 * ReasoningPlugin that handles AI-powered reasoning capabilities
 */
export class ReasoningPlugin implements IPlugin {
    private initialized: boolean = false;
    private logger: any;
    private modelProvider: IModelProvider | null = null;
    private providerFactory: ProviderFactory | null = null;
    private defaultModel: string = 'gpt-4o'; // Can be overridden by config

    constructor(options: {
        logger: any,
        providerFactory?: ProviderFactory,
        config?: {
            defaultModel?: string
        }
    }) {
        this.logger = options.logger;

        // Set configuration options if provided
        if (options.config?.defaultModel) {
            this.defaultModel = options.config.defaultModel;
        }

        this.providerFactory = options.providerFactory || null;
    }

    /**
     * Get the ID of this plugin
     */
    public getId(): UUID {
        return 'reasoning-plugin';
    }

    /**
     * Get the name of this plugin
     */
    public getName(): string {
        return 'Reasoning Plugin';
    }

    /**
     * Check if this plugin can handle an intent
     */
    public canHandle(intent: Intent): boolean {
        return intent.action.startsWith('reasoning:');
    }

    /**
     * Get the list of intents this plugin supports
     */
    public supportedIntents(): string[] {
        return [
            'reasoning:analyze',
            'reasoning:solve'
        ];
    }

    /**
     * Initialize the plugin
     */
    public async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        this.logger.info('Initializing ReasoningPlugin');

        // Check if we have a model provider, try to initialize it if not
        if (!this.modelProvider && this.providerFactory) {
            try {
                this.modelProvider = this.providerFactory.getProvider();
                this.logger.info(`ReasoningPlugin initialized with AI provider: ${this.modelProvider.constructor.name}`);
            } catch (error) {
                this.logger.error('Failed to initialize AI provider:', error);
                this.logger.warn('Reasoning capabilities will be limited to fallback implementations');
                this.modelProvider = null;
            }
        } else if (!this.modelProvider) {
            this.logger.warn('ReasoningPlugin initialized without a model provider; reasoning will be limited to fallback implementations');
        }

        this.initialized = true;
    }

    /**
     * Shutdown the plugin
     */
    public async shutdown(): Promise<void> {
        this.logger.info('Shutting down ReasoningPlugin');
        this.initialized = false;
    }

    /**
     * Execute an intent
     */
    public async execute(intent: Intent, context: RequestContext): Promise<PluginResult> {
        if (!this.initialized) {
            return {
                success: false,
                error: 'Plugin not initialized'
            };
        }

        try {
            switch (intent.action) {
                case 'reasoning:analyze':
                    return this.handleAnalyze(intent.data, context);
                case 'reasoning:solve':
                    return this.handleSolve(intent.data, context);
                default:
                    return {
                        success: false,
                        error: `Unsupported intent: ${intent.action}`
                    };
            }
        } catch (error) {
            this.logger.error(`Error executing intent ${intent.action}:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                data: {
                    failureTime: new Date().toISOString()
                }
            };
        }
    }

    /**
     * Handle analyzing content
     */
    private async handleAnalyze(data: any, context: RequestContext): Promise<PluginResult> {
        const { content, options } = data || {};

        if (!content) {
            return {
                success: false,
                error: 'Content is required for analysis'
            };
        }

        if (!this.modelProvider) {
            return {
                success: false,
                error: 'Analysis requires an AI provider, but none is available'
            };
        }

        try {
            // Create an analysis prompt for the AI
            const analysisPrompt = {
                model: options?.model || this.defaultModel,
                messages: [
                    {
                        role: 'system',
                        content: `Analyze the following content and provide insights. 
                        Return a JSON object with the following structure:
                        {
                          "sentiment": "positive|negative|neutral",
                          "topics": ["topic1", "topic2"],
                          "complexity": "simple|medium|complex",
                          "summary": "brief summary",
                          "key_points": ["point1", "point2"]
                        }`
                    },
                    {
                        role: 'user',
                        content: content
                    }
                ],
                temperature: options?.temperature || 0.3,
                maxTokens: options?.maxTokens || 500,
                responseFormat: {
                    type: 'json_object'
                }
            };

            // Get the analysis from the AI
            const response = await this.modelProvider.generateCompletion(analysisPrompt);
            let analysis;

            try {
                // Try to parse the JSON response
                const content = response?.choices?.[0]?.message?.content || '{}';
                analysis = JSON.parse(content);
            } catch (parseError) {
                this.logger.error('Failed to parse analysis response:', parseError);
                return {
                    success: false,
                    error: 'Failed to parse analysis response'
                };
            }

            return {
                success: true,
                data: {
                    analysis,
                    timestamp: new Date().toISOString()
                }
            };
        } catch (error) {
            this.logger.error('Error analyzing content:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                data: {
                    failureTime: new Date().toISOString()
                }
            };
        }
    }

    /**
     * Handle solving a problem
     */
    private async handleSolve(data: Record<string, any>, context: RequestContext): Promise<PluginResult> {
        const { problem, context: problemContext, options } = data || {};

        if (!problem) {
            return {
                success: false,
                error: 'Problem statement is required'
            };
        }

        // Determine if this is a message response request
        const isMessageResponse = problem.toLowerCase().includes('generate a response') ||
            problem.toLowerCase().includes('respond to');

        try {
            // Extract the original message if this is a response request
            let originalMessage = '';
            if (isMessageResponse) {
                const messageMatch = problem.match(/(?:to|for):?\s*["'](.+?)["']/i);
                if (messageMatch) {
                    originalMessage = messageMatch[1];
                } else {
                    // Try another pattern to extract the message
                    const altMatch = problem.match(/respond to ['"](.*?)['"]|message: ['"](.*?)['"]|generate (?:a )?response (?:for|to) ['"](.*?)['"]/i);
                    if (altMatch) {
                        originalMessage = altMatch[1] || altMatch[2] || altMatch[3] || '';
                    }
                }
            }

            // Format context for the model
            let formattedContext = this.formatContextForPrompt(problemContext, isMessageResponse);

            // Check if model provider is available
            if (this.modelProvider) {
                // Use specialized prompting based on the task type
                if (isMessageResponse) {
                    return await this.generateMessageResponse(originalMessage || problem, formattedContext, options);
                } else {
                    return await this.generateProblemSolution(problem, formattedContext, options);
                }
            } else {
                // Fallback logic when no model provider is available
                this.logger.warn('No model provider available, using fallback reasoning logic');

                // Generate a more dynamic fallback response
                if (isMessageResponse) {
                    return this.generateFallbackMessageResponse(originalMessage || problem, problemContext);
                } else {
                    return this.generateFallbackSolution(problem, problemContext);
                }
            }
        } catch (error) {
            this.logger.error(`Error solving problem: ${error}`);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                data: {
                    failureTime: new Date().toISOString()
                }
            };
        }
    }

    /**
     * Format context items in a way that's optimized for the model
     */
    private formatContextForPrompt(contextItems: ContextItem[] = [], isMessageResponse: boolean): string {
        if (!contextItems || contextItems.length === 0) {
            return '';
        }

        // For message responses, format as a conversation history
        if (isMessageResponse) {
            let conversationHistory = '\nRelevant conversation history:\n';

            return contextItems
                .map((item, index) => {
                    // Handle different context item formats
                    if (typeof item === 'string') {
                        return `[${index + 1}] ${item}`;
                    } else if (item.content?.text) {
                        const sender = item.content.sender || 'User';
                        const timestamp = item.metadata?.timestamp ?
                            new Date(item.metadata.timestamp).toLocaleString() :
                            (item.content.timestamp ? new Date(item.content.timestamp).toLocaleString() : '');

                        return `[${index + 1}] ${timestamp ? `(${timestamp}) ` : ''}${sender}: ${item.content.text}`;
                    } else {
                        return `[${index + 1}] ${JSON.stringify(item)}`;
                    }
                })
                .join('\n\n');
        }

        // For other tasks, format as relevant context information
        return '\nRelevant context:\n' + contextItems
            .map((item, index) => {
                if (typeof item === 'string') return `[${index + 1}] ${item}`;
                if (item.content?.text) return `[${index + 1}] ${item.content.text}`;
                return `[${index + 1}] ${JSON.stringify(item)}`;
            })
            .join('\n\n');
    }

    /**
     * Generate a response to a message using conversation-optimized prompting
     */
    private async generateMessageResponse(
        message: string,
        context: string,
        options?: ReasoningOptions
    ): Promise<PluginResult> {
        if (!this.modelProvider) {
            return {
                success: false,
                error: 'No AI provider available'
            };
        }

        // Use a conversational system prompt for message responses
        const systemPrompt = options?.systemContext ||
            `You are a helpful, friendly assistant in a conversation. Your goal is to provide a natural, conversational response.
            
            Guidelines:
            - Keep your response concise but informative
            - Be direct and address the user's question or comment
            - Maintain a conversational tone throughout
            - If you're unsure, acknowledge your uncertainty rather than making things up
            - If the user's message includes multiple questions, address each one
            - Do NOT use phrases like "as an AI" or meta-commentary about being an assistant
            
            Below is some relevant context that may help you provide a better response.`;

        // Optionally use a faster model for simple responses
        const model = options?.model ||
            (message.length < 100 ? 'gpt-3.5-turbo' : this.defaultModel);

        // Build the completion request
        const completionParams = {
            model: model,
            messages: [
                {
                    role: 'system',
                    content: systemPrompt + context
                },
                {
                    role: 'user',
                    content: message
                }
            ],
            temperature: options?.temperature || 0.7, // Higher temperature for more natural responses
            maxTokens: options?.maxTokens || 600
        };

        try {
            this.logger.debug('Generating message response with AI', {
                messageLength: message.length,
                model,
                temperature: options?.temperature || 0.7
            });

            // Get the response from the model
            const response = await this.modelProvider.generateCompletion(completionParams);

            // Extract the solution from the response
            let solution = '';

            if (response.content) {
                // Handle string content directly
                if (typeof response.content === 'string') {
                    solution = response.content;
                }
                // Handle array content (like from OpenAI)
                else if (Array.isArray(response.content)) {
                    solution = response.content
                        .map(item => item.text || '')
                        .join('');
                }
            }
            // Handle OpenAI-style response where content is in choices[0].message.content
            else if (response.choices && response.choices[0]?.message?.content) {
                solution = response.choices[0].message.content;
            }

            // If we couldn't extract a solution, use a fallback
            if (!solution || solution.trim().length === 0) {
                solution = 'I was unable to generate a response at this time.';
            }

            const metadata: ReasoningMetadata = {
                model: model,
                approach: 'conversational',
                timestamp: new Date().toISOString()
            };

            this.logger.debug('Successfully generated message response with AI', {
                solutionLength: solution.length,
                model
            });

            return {
                success: true,
                data: {
                    solution,
                    confidence: 0.9,
                    metadata
                }
            };
        } catch (error) {
            this.logger.error('Error generating message response with AI:', error);

            // Fall back to rule-based response generation
            this.logger.info('Falling back to rule-based message response generation');
            return this.generateFallbackMessageResponse(message, context as any);
        }
    }

    /**
     * Generate a solution to a problem using task-optimized prompting
     */
    private async generateProblemSolution(
        problem: string,
        context: string,
        options?: ReasoningOptions
    ): Promise<PluginResult> {
        if (!this.modelProvider) {
            return {
                success: false,
                error: 'No AI provider available'
            };
        }

        // Use a more structured, analytical system prompt for problem-solving
        const systemPrompt = options?.systemContext ||
            `You are an expert problem-solver with deep analytical abilities. Your task is to solve the given problem thoroughly and accurately.
            
            Approach:
            1. Analyze the problem carefully
            2. Consider different approaches and their implications
            3. Provide a clear, detailed solution
            4. Explain your reasoning if appropriate
            5. Be precise and accurate in your response
            
            Below is context that may be relevant to solving this problem.`;

        // Use a more powerful model for complex problem-solving
        const model = options?.model || this.defaultModel;

        // Build the completion request
        const completionParams = {
            model: model,
            messages: [
                {
                    role: 'system',
                    content: systemPrompt + context
                },
                {
                    role: 'user',
                    content: problem
                }
            ],
            temperature: options?.temperature || 0.3, // Lower temperature for more focused responses
            maxTokens: options?.maxTokens || 1000
        };

        try {
            this.logger.debug('Generating problem solution with AI', {
                problemLength: problem.length,
                model,
                temperature: options?.temperature || 0.3
            });

            // Get the solution from the model
            const response = await this.modelProvider.generateCompletion(completionParams);

            // Extract the solution from the response
            let solution = '';

            if (response.content) {
                // Handle string content directly
                if (typeof response.content === 'string') {
                    solution = response.content;
                }
                // Handle array content (like from OpenAI)
                else if (Array.isArray(response.content)) {
                    solution = response.content
                        .map(item => item.text || '')
                        .join('');
                }
            }
            // Handle OpenAI-style response where content is in choices[0].message.content
            else if (response.choices && response.choices[0]?.message?.content) {
                solution = response.choices[0].message.content;
            }

            // If we couldn't extract a solution, use a fallback
            if (!solution || solution.trim().length === 0) {
                solution = 'Unable to generate a solution at this time.';
            }

            // Extract basic metadata
            const wordCount = solution.split(/\s+/).length;
            const confidence = 0.85;  // Default confidence for a direct solution

            const metadata: ReasoningMetadata = {
                wordCount,
                model: model,
                approach: 'analytical',
                timestamp: new Date().toISOString()
            };

            this.logger.debug('Successfully generated problem solution with AI', {
                solutionLength: solution.length,
                wordCount,
                model
            });

            return {
                success: true,
                data: {
                    solution,
                    confidence,
                    metadata
                }
            };
        } catch (error) {
            this.logger.error('Error generating problem solution with AI:', error);

            // Fall back to rule-based solution generation
            this.logger.info('Falling back to rule-based problem solution generation');
            return this.generateFallbackSolution(problem, context as any);
        }
    }

    /**
     * Generate a fallback message response when no AI provider is available
     */
    private generateFallbackMessageResponse(message: string, contextItems: any[]): PluginResult {
        this.logger.debug('Generating fallback message response', { messageLength: message.length });

        // Extract context content if available
        const contextContent = Array.isArray(contextItems)
            ? contextItems.map(item => typeof item === 'string' ? item :
                (item.content?.text || JSON.stringify(item))).join(' ')
            : '';

        let response = '';

        // Generate different responses based on message content
        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes('hello') || lowerMessage.includes('hi ') || lowerMessage.startsWith('hi') || lowerMessage.includes('hey')) {
            response = 'Hello! How can I help you today?';
        } else if (lowerMessage.includes('how are you')) {
            response = "I'm doing well, thank you for asking! How can I assist you?";
        } else if (lowerMessage.includes('thank')) {
            response = "You're welcome! Let me know if you need anything else.";
        } else if (lowerMessage.includes('?')) {
            // For questions, provide a response indicating the system is processing
            response = `I understand you're asking about "${message.replace(/\?/g, '')}". Let me think about that.`;

            // Use context if available to enhance response
            if (contextContent && contextContent.length > 0) {
                // Extract potentially relevant keywords from context
                const words = contextContent.split(/\s+/).filter(w => w.length > 4);
                if (words.length > 0) {
                    const randomWord = words[Math.floor(Math.random() * words.length)];
                    response += ` Based on the information about "${randomWord}", I would recommend considering different approaches.`;
                }
            }
        } else {
            // Generic response for other messages
            response = `I acknowledge your message about "${message.substring(0, 30)}${message.length > 30 ? '...' : ''}". How would you like to proceed?`;
        }

        return {
            success: true,
            data: {
                solution: response,
                confidence: 0.6,
                metadata: {
                    model: 'fallback',
                    approach: 'rule-based',
                    timestamp: new Date().toISOString()
                }
            }
        };
    }

    /**
     * Generate a fallback solution when no AI provider is available
     */
    private generateFallbackSolution(problem: string, contextItems: any[]): PluginResult {
        this.logger.debug('Generating fallback solution', { problemLength: problem.length });

        // Extract context content if available
        const contextContent = Array.isArray(contextItems)
            ? contextItems.map(item => typeof item === 'string' ? item :
                (item.content?.text || JSON.stringify(item))).join(' ')
            : '';

        let solution = '';
        const problemLower = problem.toLowerCase();

        // Generate response based on problem type
        if (problemLower.includes('summarize') || problemLower.includes('summary')) {
            solution = `Here's a summary of the key points:\n\n`;

            if (contextContent && contextContent.length > 0) {
                // Extract sentences for a summary
                const sentences = contextContent.split(/[.!?]+/).filter(s => s.trim().length > 10);
                const selectedSentences = sentences.slice(0, Math.min(3, sentences.length));

                solution += selectedSentences.map(s => `- ${s.trim()}`).join('\n');
            } else {
                solution += `- Unable to generate a detailed summary without context\n- The requested topic appears to be about "${problem.substring(0, 40)}..."\n- Additional information would be needed for a comprehensive summary`;
            }
        } else if (problemLower.includes('analyze') || problemLower.includes('analysis')) {
            solution = `Analysis of the problem:\n\n`;

            if (contextContent && contextContent.length > 0) {
                // Create a simple analysis based on word frequency
                const words = contextContent.toLowerCase().split(/\W+/).filter(w => w.length > 4);
                const wordFreq: Record<string, number> = {};

                words.forEach(word => {
                    wordFreq[word] = (wordFreq[word] || 0) + 1;
                });

                const topWords = Object.entries(wordFreq)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5);

                solution += `1. Key topics identified: ${topWords.map(([word]) => word).join(', ')}\n`;
                solution += `2. The context contains approximately ${words.length} significant words\n`;
                solution += `3. This appears to be related to ${problemLower.substring(0, 30)}...`;
            } else {
                solution += `1. The problem statement is: "${problem}"\n`;
                solution += `2. Without additional context, a comprehensive analysis is limited\n`;
                solution += `3. Consider providing more details for a better analysis`;
            }
        } else {
            // Generic problem solution
            solution = `Regarding the problem: "${problem.substring(0, 50)}${problem.length > 50 ? '...' : ''}"\n\n`;
            solution += `Based on the available information, here are some considerations:\n\n`;
            solution += `1. The problem appears to be about ${problem.substring(0, 20)}...\n`;
            solution += `2. Further investigation would be needed for a complete solution\n`;
            solution += `3. Consider breaking this down into smaller, more manageable parts`;
        }

        return {
            success: true,
            data: {
                solution,
                confidence: 0.5,
                metadata: {
                    model: 'fallback',
                    approach: 'rule-based',
                    timestamp: new Date().toISOString()
                }
            }
        };
    }
} 