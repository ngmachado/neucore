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
     * Handle reasoning solve intent
     */
    private async handleSolve(data: any, context: RequestContext): Promise<PluginResult> {
        const { problem, context: problemContext, options } = data || {};

        console.log(`[REASONING] Processing solve request for problem: "${problem?.substring(0, 50)}..."`);

        if (!problem) {
            console.log(`[REASONING] Error: Missing problem statement`);
            return {
                success: false,
                error: 'Problem statement is required'
            };
        }

        // Determine if this is a message response request
        const isMessageResponse = problem.toLowerCase().includes('generate a response') ||
            problem.toLowerCase().includes('respond to');

        console.log(`[REASONING] Problem type: ${isMessageResponse ? 'Message Response' : 'General Problem'}`);

        try {
            // Extract the original message if this is a response request
            let originalMessage = '';
            if (isMessageResponse) {
                const messageMatch = problem.match(/(?:to|for):?\s*["'](.+?)["']/i);
                if (messageMatch) {
                    originalMessage = messageMatch[1];
                    console.log(`[REASONING] Extracted original message: "${originalMessage}"`);
                } else {
                    // Try another pattern to extract the message
                    const altMatch = problem.match(/respond to ['"](.*?)['"]|message: ['"](.*?)['"]|generate (?:a )?response (?:for|to) ['"](.*?)['"]/i);
                    if (altMatch) {
                        originalMessage = altMatch[1] || altMatch[2] || altMatch[3] || '';
                        console.log(`[REASONING] Extracted original message (alt): "${originalMessage}"`);
                    }
                }
            }

            // Format context for the model
            let formattedContext = this.formatContextForPrompt(problemContext, isMessageResponse);
            console.log(`[REASONING] Formatted context with ${formattedContext ? formattedContext.length : 0} characters`);

            // Check if model provider is available
            if (this.modelProvider) {
                console.log(`[REASONING] Using model provider for ${isMessageResponse ? 'message response' : 'problem solving'}`);
                const startTime = Date.now();

                // Use specialized prompting based on the task type
                let result;

                // Use the existing generateProblemSolution for both cases
                // but log that we're using it for message response as a workaround
                if (isMessageResponse) {
                    console.log(`[REASONING] Using problem solution method for message response (simplified logging)`);
                    result = await this.generateProblemSolution(originalMessage || problem, formattedContext, {
                        ...options,
                        systemContext: `You are responding as a helpful assistant in a conversation. 
                        Your goal is to provide a natural, conversational response to: "${originalMessage}".
                        
                        Guidelines:
                        - Keep your response concise but informative
                        - Be direct and address the user's question or comment
                        - Maintain a conversational tone throughout
                        - If you're unsure, acknowledge your uncertainty rather than making things up
                        - If the user's message includes multiple questions, address each one
                        - Do NOT use phrases like "as an AI" or meta-commentary about being an assistant`
                    });
                } else {
                    result = await this.generateProblemSolution(problem, formattedContext, options);
                }

                const processingTime = Date.now() - startTime;
                console.log(`[REASONING] Generated solution in ${processingTime}ms`);

                if (result.data?.solution) {
                    console.log(`[REASONING] Solution length: ${result.data.solution.length} chars`);
                }

                return result;
            } else {
                // Fallback logic when no model provider is available
                console.log(`[REASONING] No model provider available, using fallback reasoning`);
                this.logger.warn('No model provider available, using fallback reasoning logic');

                // Generate a more dynamic fallback response
                const startTime = Date.now();
                let result;

                if (isMessageResponse) {
                    result = this.generateFallbackMessageResponse(originalMessage || problem, problemContext);
                } else {
                    result = this.generateFallbackSolution(problem, []);
                }

                const processingTime = Date.now() - startTime;
                console.log(`[REASONING] Generated fallback solution in ${processingTime}ms`);

                return result;
            }
        } catch (error) {
            console.log(`[REASONING] Error solving problem: ${error instanceof Error ? error.message : String(error)}`);
            this.logger.error(`Error solving problem: ${error instanceof Error ? error.message : String(error)}`);
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

        // Check if chain reasoning is enabled
        const useChainedReasoning = options?.useChainedReasoning !== false;
        console.log(`[REASONING-CHAIN] Chain reasoning enabled: ${useChainedReasoning}`);

        // Use a more structured, analytical system prompt for problem-solving
        const systemPrompt = options?.systemContext ||
            `You are an expert problem-solver with deep analytical abilities. Your task is to solve the given problem thoroughly and accurately.
            
            Approach:
            1. Analyze the problem carefully
            2. Consider different approaches and their implications
            3. Provide a clear, detailed solution
            4. Explain your reasoning if appropriate
            5. Be precise and accurate in your response
            6. Assess whether you have sufficient information to form a complete solution
            
            For complex problems, you should continue reasoning through multiple steps.
            For simpler problems, you should provide a solution as soon as you have enough information.
            When your reasoning is complete, indicate this by adding [SOLUTION_COMPLETE] at the end of your step.
            
            Below is context that may be relevant to solving this problem.`;

        // Use a more powerful model for complex problem-solving
        const model = options?.model || this.defaultModel;

        if (useChainedReasoning) {
            console.log(`[REASONING-CHAIN] Starting chain-of-thought reasoning process`);

            // Define reasoning parameters
            const maxSteps = options?.maxIterations || 8;
            const temperature = options?.temperature || 0.7;
            console.log(`[REASONING-CHAIN] Maximum steps: ${maxSteps}, Temperature: ${temperature}`);

            // Initialize chain with first step
            const steps = [];
            let currentStep = `I need to solve this problem: "${problem}"\n\nI'll break this down into steps:`;
            steps.push(currentStep);
            console.log(`[REASONING-CHAIN] Step 0 (Problem): ${currentStep.substring(0, 100)}...`);

            let solutionComplete = false;
            let confidence = 0;

            // Generate each reasoning step
            for (let i = 0; i < maxSteps; i++) {
                console.log(`[REASONING-CHAIN] Generating step ${i + 1} of ${maxSteps}`);

                // Build the completion request for this step
                const stepPrompt = `
You are working through a reasoning problem step by step.
Previous reasoning steps:
${steps.join('\n\n')}

Continue the reasoning process by generating the next step.
After generating your step, evaluate whether you have enough information to provide a complete solution.

Confidence Assessment:
1. Assess your confidence in the solution on a scale of 0-100%
2. If your confidence is 85% or higher, your reasoning is likely sufficient
3. Consider the complexity of the problem and whether additional steps would meaningfully improve your answer

If your reasoning is sufficient to solve the problem, end your response with:
[CONFIDENCE: X%] [SOLUTION_COMPLETE]
(where X is your confidence percentage)

${i === maxSteps - 1 ? 'This should be the final step where you state your conclusion.' : ''}
`;

                try {
                    const stepStartTime = Date.now();

                    // Get the next step from the model
                    const stepResponse = await this.modelProvider.generateCompletion({
                        model: model,
                        messages: [
                            {
                                role: 'system',
                                content: systemPrompt
                            },
                            {
                                role: 'user',
                                content: stepPrompt + context
                            }
                        ],
                        temperature: temperature,
                        maxTokens: options?.maxTokens || 800
                    });

                    // Extract step content
                    let stepContent = '';
                    if (stepResponse.content) {
                        // Handle string content directly
                        if (typeof stepResponse.content === 'string') {
                            stepContent = stepResponse.content;
                        }
                        // Handle array content
                        else if (Array.isArray(stepResponse.content)) {
                            stepContent = stepResponse.content
                                .map(item => item.text || '')
                                .join('');
                        }
                    }
                    // Handle OpenAI-style response
                    else if (stepResponse.choices && stepResponse.choices[0]?.message?.content) {
                        stepContent = stepResponse.choices[0].message.content;
                    }

                    // Check if solution is complete
                    let confidence = 0;
                    const confidenceMatch = stepContent.match(/\[CONFIDENCE:\s*(\d+)%\]/i);
                    if (confidenceMatch && confidenceMatch[1]) {
                        confidence = parseInt(confidenceMatch[1], 10);
                        stepContent = stepContent.replace(/\[CONFIDENCE:\s*\d+%\]/i, '').trim();
                        console.log(`[REASONING-CHAIN] AI confidence level: ${confidence}%`);
                    }

                    if (stepContent.includes('[SOLUTION_COMPLETE]')) {
                        solutionComplete = true;
                        stepContent = stepContent.replace('[SOLUTION_COMPLETE]', '').trim();
                        console.log(`[REASONING-CHAIN] AI signaled solution is complete at step ${i + 1} with ${confidence}% confidence`);
                    }

                    currentStep = stepContent;
                    steps.push(currentStep);

                    const stepTime = Date.now() - stepStartTime;
                    console.log(`[REASONING-CHAIN] Step ${i + 1} generated in ${stepTime}ms`);
                    console.log(`[REASONING-CHAIN] Step ${i + 1} content: ${currentStep.substring(0, 100)}...`);

                    // Check if we've reached a conclusion or if the AI indicates the solution is complete
                    if (solutionComplete ||
                        currentStep.toLowerCase().includes('my final answer is') ||
                        currentStep.toLowerCase().includes('in conclusion') ||
                        currentStep.toLowerCase().includes('therefore, the solution') ||
                        currentStep.toLowerCase().includes('thus, the answer')) {
                        console.log(`[REASONING-CHAIN] Found conclusion in step ${i + 1}, stopping chain`);
                        break;
                    }
                } catch (error) {
                    console.log(`[REASONING-CHAIN] Error generating step ${i + 1}: ${error instanceof Error ? error.message : String(error)}`);
                    break;
                }
            }

            // Generate final solution based on all steps
            console.log(`[REASONING-CHAIN] Generating final solution from ${steps.length} steps`);
            const solutionStartTime = Date.now();

            // Build prompt for final solution
            const solutionPrompt = `
You've completed a multi-step reasoning process to solve this problem:
"${problem}"

Your reasoning steps were:
${steps.map((step, index) => `Step ${index}: ${step}`).join('\n\n')}

Based on this reasoning, provide your final solution to the original problem. 
Be concise but complete. Don't say "based on my reasoning" or repeat the steps.
Just provide the solution directly.
`;

            try {
                // Get the final solution from the model
                const solutionResponse = await this.modelProvider.generateCompletion({
                    model: model,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are providing the final solution to a problem after careful reasoning.'
                        },
                        {
                            role: 'user',
                            content: solutionPrompt
                        }
                    ],
                    temperature: 0.3, // Lower temperature for final solution
                    maxTokens: options?.maxTokens || 1000
                });

                // Extract solution content
                let solution = '';
                if (solutionResponse.content) {
                    // Handle string content directly
                    if (typeof solutionResponse.content === 'string') {
                        solution = solutionResponse.content;
                    }
                    // Handle array content
                    else if (Array.isArray(solutionResponse.content)) {
                        solution = solutionResponse.content
                            .map(item => item.text || '')
                            .join('');
                    }
                }
                // Handle OpenAI-style response
                else if (solutionResponse.choices && solutionResponse.choices[0]?.message?.content) {
                    solution = solutionResponse.choices[0].message.content;
                }

                const solutionTime = Date.now() - solutionStartTime;
                console.log(`[REASONING-CHAIN] Final solution generated in ${solutionTime}ms`);
                console.log(`[REASONING-CHAIN] Solution: ${solution.substring(0, 100)}...`);

                // Extract basic metadata
                const wordCount = solution.split(/\s+/).length;
                const confidence = 0.9;  // Higher confidence for chain reasoning

                // Return the result with chain steps as metadata
                return {
                    success: true,
                    data: {
                        solution,
                        steps,
                        metadata: {
                            model,
                            approach: 'chain-of-thought',
                            stepCount: steps.length,
                            maxSteps: maxSteps,
                            earlyTermination: steps.length < maxSteps && solutionComplete,
                            confidenceLevel: confidence,
                            wordCount,
                            timestamp: new Date().toISOString(),
                            reasoning_chain: steps
                        }
                    }
                };
            } catch (error) {
                console.log(`[REASONING-CHAIN] Error generating final solution: ${error instanceof Error ? error.message : String(error)}`);

                // Fall back to using the last step as the solution
                if (steps.length > 0) {
                    const fallbackSolution = steps[steps.length - 1];

                    return {
                        success: true,
                        data: {
                            solution: fallbackSolution,
                            steps,
                            metadata: {
                                model,
                                approach: 'chain-of-thought-fallback',
                                stepCount: steps.length,
                                maxSteps: maxSteps,
                                earlyTermination: steps.length < maxSteps && solutionComplete,
                                confidenceLevel: confidence || 70, // Moderate confidence for fallback
                                timestamp: new Date().toISOString(),
                                reasoning_chain: steps
                            }
                        }
                    };
                }
            }
        }

        // Single-step reasoning (original implementation for when chained reasoning is disabled)
        console.log(`[REASONING] Using direct (non-chain) reasoning method`);

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
                model: model,
                approach: 'analytical',
                wordCount,
                timestamp: new Date().toISOString()
            };

            this.logger.debug('Successfully generated problem solution with AI', {
                solutionLength: solution.length,
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

            // Create a fallback solution
            const fallbackSolution = this.generateFallbackSolution(problem, []).data.solution;

            return {
                success: true,
                data: {
                    solution: fallbackSolution,
                    confidence: 0.6,  // Lower confidence for fallback
                    metadata: {
                        approach: 'fallback',
                        timestamp: new Date().toISOString()
                    }
                }
            };
        }
    }

    /**
     * Generate a fallback message response when no AI provider is available
     */
    private generateFallbackMessageResponse(message: string, contextItems: any[]): PluginResult {
        this.logger.debug('Generating fallback message response', { messageLength: message.length });

        // Simple unavailability message instead of trying to fake intelligence
        const response = "I'm sleeping now, try to awake me later.";

        return {
            success: true,
            data: {
                solution: response,
                confidence: 0.5,
                metadata: {
                    model: 'fallback',
                    approach: 'unavailable',
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

        // Simple unavailability message instead of trying to fake intelligence
        const solution = "I'm sleeping now, try to awake me later.";

        return {
            success: true,
            data: {
                solution,
                confidence: 0.5,
                metadata: {
                    model: 'fallback',
                    approach: 'unavailable',
                    timestamp: new Date().toISOString()
                }
            }
        };
    }
}