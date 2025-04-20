import { IPlugin, PluginResult, RequestContext } from '../mcp/interfaces/plugin';
import { Intent } from '../mcp/intent';
import { UUID } from '../types';
import { ProviderFactory } from '../core/providers';
import { IModelProvider, CompletionParams } from '../core/providers/modelProvider';
import {
    IReasoner,
    ReasoningResult,
    ReasoningProgress
} from '../core/reasoning/reasoner';
import { ChainOfThoughtReasoner } from '../core/reasoning/chainOfThoughtReasoner';
import { SocraticReasoner } from '../core/reasoning/socraticReasoner';
import { DialogicReasoner } from '../core/reasoning/dialogicReasoner';
import { ReasoningMethod, ReasoningOptions as CoreReasoningOptions } from '../core/reasoning/types';

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
    method?: ReasoningMethod | string;
    methodOptions?: Record<string, any>;
}

/**
 * Convert plugin reasoning options to core reasoning options
 * 
 * This function handles type compatibility between the plugin-specific ReasoningOptions
 * and the core CoreReasoningOptions used by the reasoners. Plugin-specific properties
 * that don't exist in the core options are moved to methodOptions to preserve them.
 * 
 * @param options Plugin options
 * @param defaultModel Default model to use if not specified in options
 * @returns Core reasoning options
 */
function convertToCoreOptions(options?: ReasoningOptions, defaultModel?: string): Partial<CoreReasoningOptions> {
    if (!options) return {};

    console.log(`[CONVERT] Input method type: ${typeof options.method}`);
    console.log(`[CONVERT] Input method value: ${options.method}`);

    // Handle method mapping - convert string to enum if needed
    let method: ReasoningMethod | undefined;

    // If it's a string, map it to the appropriate enum value
    if (typeof options.method === 'string') {
        switch (options.method.toLowerCase()) {
            case 'socratic':
                method = ReasoningMethod.SOCRATIC;
                break;
            case 'dialogic':
                method = ReasoningMethod.DIALOGIC;
                break;
            case 'chain_of_thought':
            case 'chainofthought':
                method = ReasoningMethod.CHAIN_OF_THOUGHT;
                break;
            case 'tree_of_thought':
            case 'treeofthought':
                method = ReasoningMethod.TREE_OF_THOUGHT;
                break;
            case 'react':
                method = ReasoningMethod.REACT;
                break;
            case 'first_principles':
            case 'firstprinciples':
                method = ReasoningMethod.FIRST_PRINCIPLES;
                break;
            case 'reflexion':
                method = ReasoningMethod.REFLEXION;
                break;
            default:
                // Default to chain of thought if string doesn't match
                console.log(`[CONVERT] Method string "${options.method}" not recognized, defaulting to CHAIN_OF_THOUGHT`);
                method = ReasoningMethod.CHAIN_OF_THOUGHT;
                break;
        }
    } else if (options.method !== undefined) {
        // If it's not a string but is defined, use it directly
        method = options.method;
    } else {
        // Default if undefined
        method = ReasoningMethod.CHAIN_OF_THOUGHT;
    }

    console.log(`[CONVERT] Final method: ${method}`);

    // Only include properties that exist in CoreReasoningOptions
    return {
        method,
        temperature: options.temperature,
        maxDepth: options.maxDepth,
        maxIterations: options.maxIterations,
        methodOptions: {
            ...options.methodOptions,
            // Move plugin-specific options to methodOptions
            model: options.model || defaultModel,
            maxTokens: options.maxTokens,
            systemContext: options.systemContext,
            useChainedReasoning: options.useChainedReasoning
        }
    };
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

        // Log full options received
        console.log(`[REASONING] Full options received: ${JSON.stringify(options)}`);

        // Determine which reasoning method to use
        const methodInput = options?.method || ReasoningMethod.CHAIN_OF_THOUGHT;
        console.log(`[REASONING] Input reasoning method: ${methodInput}`);
        console.log(`[REASONING] Method type: ${typeof methodInput}`);
        console.log(`[REASONING] Raw method value: ${JSON.stringify(methodInput)}`);

        // Convert string method to enum if needed
        let method: ReasoningMethod;

        if (typeof methodInput === 'string') {
            // Enhanced string matching with better logging
            console.log(`[REASONING] Processing string method: "${methodInput}"`);

            // Normalize the string input by removing underscores and converting to lowercase
            const normalizedMethod = methodInput.toLowerCase().replace(/_/g, '').trim();

            // Log the normalized method string
            console.log(`[REASONING] Normalized method string: "${normalizedMethod}"`);

            switch (normalizedMethod) {
                case 'socratic':
                    console.log(`[REASONING] Matched 'socratic' string, using Socratic reasoning`);
                    method = ReasoningMethod.SOCRATIC;
                    break;
                case 'dialogic':
                    console.log(`[REASONING] Matched 'dialogic' string, using Dialogic reasoning`);
                    method = ReasoningMethod.DIALOGIC;
                    break;
                case 'chainofthought':
                    console.log(`[REASONING] Matched 'chain_of_thought' string, using Chain of Thought reasoning`);
                    method = ReasoningMethod.CHAIN_OF_THOUGHT;
                    break;
                default:
                    console.log(`[REASONING] No string match for "${methodInput}", defaulting to chain_of_thought`);
                    method = ReasoningMethod.CHAIN_OF_THOUGHT;
            }
        } else {
            // It's already an enum value
            console.log(`[REASONING] Using enum value directly: ${methodInput}`);
            method = methodInput;
        }

        console.log(`[REASONING] Using reasoning method: ${method}`);
        console.log(`[REASONING] Final method type: ${typeof method}`);
        console.log(`[REASONING] Is equal to SOCRATIC enum: ${method === ReasoningMethod.SOCRATIC}`);
        console.log(`[REASONING] Is equal to 'socratic' string: ${method === 'socratic'}`);
        console.log(`[REASONING] ReasoningMethod.SOCRATIC value: ${ReasoningMethod.SOCRATIC}`);

        // Create the appropriate reasoner based on the method
        let reasoner: IReasoner | null = null;

        try {
            switch (method) {
                case ReasoningMethod.SOCRATIC:
                    console.log(`[REASONING] Creating Socratic reasoner`);
                    // @ts-ignore - Known type mismatch between plugin and core options
                    reasoner = new SocraticReasoner(this.modelProvider, {});
                    break;

                case ReasoningMethod.DIALOGIC:
                    console.log(`[REASONING] Creating Dialogic reasoner`);
                    // @ts-ignore - Known type mismatch between plugin and core options
                    reasoner = new DialogicReasoner(this.modelProvider, {});
                    break;

                case ReasoningMethod.CHAIN_OF_THOUGHT:
                default:
                    console.log(`[REASONING] Creating Chain of Thought reasoner`);
                    // @ts-ignore - Known type mismatch between plugin and core options
                    reasoner = new ChainOfThoughtReasoner(this.modelProvider, {});
                    break;
            }

            // If we successfully created a reasoner, use it
            if (reasoner) {
                const startTime = Date.now();

                // Set up problem with context if available
                const fullProblem = context ? `${problem}\n\n${context}` : problem;

                // Convert plugin options to core options
                const coreOptions = convertToCoreOptions(options, this.defaultModel);

                // Perform reasoning
                const reasoningResult = await reasoner.reason(fullProblem, coreOptions);

                const processingTime = Date.now() - startTime;
                console.log(`[REASONING] Completed ${method} reasoning in ${processingTime}ms`);

                // Extract the solution and return it
                return {
                    success: true,
                    data: {
                        solution: reasoningResult.conclusion,
                        graph: reasoningResult.graph,
                        metadata: {
                            model: options?.model || this.defaultModel,
                            approach: method,
                            confidence: reasoningResult.confidence,
                            steps: reasoningResult.stepCount,
                            timeTaken: reasoningResult.timeTaken,
                            timestamp: new Date().toISOString()
                        }
                    }
                };
            } else {
                // If we couldn't create a reasoner, fall back to the old implementation
                console.log(`[REASONING] Using direct (non-chain) reasoning method`);

                // Use the existing method for backward compatibility
                return this.legacyGenerateProblemSolution(problem, context, options);
            }
        } catch (error) {
            console.error(`[REASONING] Error using ${method} reasoner:`, error);
            this.logger.error(`Error using ${method} reasoner: ${error}`);

            // Fall back to the legacy implementation
            console.log(`[REASONING] Falling back to legacy implementation`);
            return this.legacyGenerateProblemSolution(problem, context, options);
        }
    }

    // Rename the existing implementation to legacyGenerateProblemSolution
    private async legacyGenerateProblemSolution(
        problem: string,
        context: string,
        options?: ReasoningOptions
    ): Promise<PluginResult> {
        // Copy the original implementation here
        // This is the existing chain of thought implementation

        if (!this.modelProvider) {
            return {
                success: false,
                error: 'No AI provider available'
            };
        }

        // Extract options from the ReasoningOptions object
        const useChainedReasoning = options?.useChainedReasoning !== false;
        const systemContext = options?.systemContext;
        const model = options?.model || this.defaultModel;
        const maxTokens = options?.maxTokens || 1000;

        console.log(`[REASONING-CHAIN] Chain reasoning enabled: ${useChainedReasoning}`);

        // Use a more structured, analytical system prompt for problem-solving
        const systemPrompt = systemContext ||
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

        if (useChainedReasoning) {
            console.log(`[REASONING-CHAIN] Starting chain-of-thought reasoning process`);

            // Define reasoning parameters
            const maxSteps = options?.maxIterations || 8;
            const temperature = options?.temperature || 0.7;
            console.log(`[REASONING-CHAIN] Maximum steps: ${maxSteps}, Temperature: ${temperature}`);

            // Initialize chain with first step
            const steps = [];
            let currentStep = `Starting to analyze: Breaking down the problem into steps`;
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
Problem to solve: "${problem}"
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
                        maxTokens: maxTokens
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

            // Improved instruction prompt for final solution to avoid leakage
            const solutionPrompt = `
You've completed a multi-step reasoning process to solve this problem:
"${problem}"

Your reasoning steps were:
${steps.map((step, index) => `Step ${index}: ${step}`).join('\n\n')}

Based on this reasoning, provide your final solution.

IMPORTANT GUIDELINES:
1. Do NOT repeat the original problem statement or query in your response
2. Do NOT say phrases like "based on my reasoning" or "after analyzing the steps"
3. Do NOT include any of your reasoning steps in the response
4. Do NOT start with "I'll break this down" or meta-commentary
5. Provide ONLY the direct answer/solution in a natural, conversational style
6. For message responses, write as if you're speaking directly to the person
7. Assume the person already knows what they asked - no need to remind them

If responding to a question, start with the answer directly. 
`;

            try {
                // Get the final solution from the model
                const solutionResponse = await this.modelProvider.generateCompletion({
                    model: model,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are providing the final solution to a problem after careful reasoning. Your task is to give ONLY the solution, not to explain your reasoning process or repeat the question.'
                        },
                        {
                            role: 'user',
                            content: solutionPrompt
                        }
                    ],
                    temperature: 0.3, // Lower temperature for final solution
                    maxTokens: maxTokens
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

                // Post-process solution to clean up any remaining leaks
                solution = this.cleanupFinalSolution(solution, problem);

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
                    // Clean up the fallback solution as well
                    const fallbackSolution = this.cleanupFinalSolution(steps[steps.length - 1], problem);

                    return {
                        success: true,
                        data: {
                            solution: fallbackSolution,
                            confidence: 0.6,  // Lower confidence for fallback
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
            maxTokens: maxTokens
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

    /**
     * Post-process the final solution to clean up any remaining leaks
     * @param solution The raw solution string
     * @param problem The original problem statement
     * @returns Cleaned up solution
     */
    private cleanupFinalSolution(solution: string, problem: string): string {
        if (!solution) return solution;

        // Extract the original message to match against (for message responses)
        let originalMessage = '';
        if (problem.toLowerCase().includes('generate a response to:')) {
            const messageMatch = problem.match(/generate a response to:?\s*["'](.+?)["']/i);
            if (messageMatch && messageMatch[1]) {
                originalMessage = messageMatch[1];
            }
        } else if (problem.toLowerCase().includes('respond to:')) {
            const messageMatch = problem.match(/respond to:?\s*["'](.+?)["']/i);
            if (messageMatch && messageMatch[1]) {
                originalMessage = messageMatch[1];
            }
        }

        let cleanedSolution = solution;

        // Remove common reasoning leaks
        const leakPatterns = [
            // Pattern: I need to solve this problem: "X"
            /I need to solve (?:this|the) problem:?\s*["'].*?["']/i,
            // Pattern: I'll break this down into steps
            /I['']ll break this down into steps:?/i,
            // Pattern: Let me think through this
            /Let me think through this:?/i,
            // Pattern: Step X: 
            /^Step \d+:?\s+/im,
            // Pattern: First, I'll analyze...
            /^First,? I['']ll analyze/im,
            // Pattern: To solve this problem...
            /^To solve this problem/im,
            // Pattern: I'll start by...
            /^I['']ll start by/im,
            // Pattern: Based on my reasoning...
            /(?:based|building) on (?:my|the) (?:reasoning|analysis)/i,
            // Pattern: According to my analysis...
            /according to (?:my|the) (?:reasoning|analysis)/i,
            // Pattern: From the reasoning steps...
            /from the (?:reasoning|analysis) steps/i,
            // Pattern: After analyzing the problem...
            /after analyzing the problem/i,
            // Pattern: Based on the steps above...
            /based on the steps above/i,
            // Pattern: Looking at all the steps...
            /looking at all the steps/i,
            // Pattern: Having considered all aspects...
            /having considered all aspects/i,
        ];

        // Apply all the patterns
        for (const pattern of leakPatterns) {
            cleanedSolution = cleanedSolution.replace(pattern, '');
        }

        // If we have an original message (from a response-type query), check for repetition
        if (originalMessage && originalMessage.length > 5) {
            // Create a regex pattern to match the beginning 5+ words of the original message
            // This handles cases where the bot repeats the user's question back
            const firstFewWords = originalMessage.split(/\s+/).slice(0, 5).join('\\s+');
            if (firstFewWords.length > 10) {
                const repetitionPattern = new RegExp(`${firstFewWords}`, 'i');
                cleanedSolution = cleanedSolution.replace(repetitionPattern, '');
            }

            // Remove direct quotations of the original message
            cleanedSolution = cleanedSolution.replace(new RegExp(`["']${this.escapeRegExp(originalMessage)}["']`, 'i'), '');
        }

        // Remove reasoning meta-commentary
        const metaCommentaryPatterns = [
            /let(?:'s| us) analyze this step by step/i,
            /I(?:'ll| will) approach this methodically/i,
            /This requires a step-by-step approach/i,
            /To answer this question/i,
            /To address this/i,
            /My response to this query is/i,
            /My answer to this question is/i,
            /In response to your question/i,
            /The solution to this problem is/i,
            /My solution is/i,
            /Here's my solution/i,
            /Here's my response/i,
            /here's the answer/i,
            /The answer is as follows/i,
        ];

        for (const pattern of metaCommentaryPatterns) {
            cleanedSolution = cleanedSolution.replace(pattern, '');
        }

        // Clean up any double whitespace or leading/trailing whitespace
        cleanedSolution = cleanedSolution.replace(/\s{2,}/g, ' ').trim();

        // If the solution now starts with common transitional phrases, remove them
        const transitionalPhrases = [
            /^Therefore,?\s+/i,
            /^Thus,?\s+/i,
            /^In conclusion,?\s+/i,
            /^So,?\s+/i,
            /^Overall,?\s+/i,
            /^Finally,?\s+/i,
            /^In summary,?\s+/i,
            /^To summarize,?\s+/i,
        ];

        for (const pattern of transitionalPhrases) {
            cleanedSolution = cleanedSolution.replace(pattern, '');
        }

        return cleanedSolution.trim();
    }

    /**
     * Utility method to escape special characters in regex
     */
    private escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}