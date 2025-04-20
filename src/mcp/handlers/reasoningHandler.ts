/**
 * Reasoning Handler
 * 
 * Provides reasoning capabilities through the intent system.
 */

import { Intent } from '../intent';
import { IntentHandler, IntentResult } from '../intentHandler';
import { RequestContext } from '../interfaces/plugin';
import { IntentFilter } from '../intentFilter';
import {
    ReasoningMethod,
    ReasoningOptions
} from '../../core/reasoning/types';
import {
    ChainOfThoughtReasoner
} from '../../core/reasoning/chainOfThoughtReasoner';
import { IModelProvider } from '../../core/providers/modelProvider';

/**
 * Handler for reasoning-related intents
 */
export class ReasoningHandler implements IntentHandler {
    private reasoner: ChainOfThoughtReasoner;

    constructor(private modelProvider: IModelProvider) {
        // Initialize with default options
        this.reasoner = new ChainOfThoughtReasoner(modelProvider, {});
    }

    /**
     * Get intent filters for this handler
     */
    getIntentFilters(): IntentFilter[] {
        const filters: IntentFilter[] = [];

        // Reasoning solve filter
        const solveFilter = new IntentFilter(10);
        solveFilter.addAction('reasoning:solve');
        filters.push(solveFilter);

        // Reasoning analyze filter
        const analyzeFilter = new IntentFilter(10);
        analyzeFilter.addAction('reasoning:analyze');
        filters.push(analyzeFilter);

        return filters;
    }

    /**
     * Handle an intent
     */
    async handleIntent(intent: Intent, context: RequestContext): Promise<IntentResult> {
        try {
            switch (intent.action) {
                case 'reasoning:analyze':
                    return this.handleAnalyze(intent, context);
                case 'reasoning:solve':
                    return this.handleSolve(intent, context);
                default:
                    return {
                        success: false,
                        error: `Unsupported intent: ${intent.action}`
                    };
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Handle analyze intent
     */
    private async handleAnalyze(intent: Intent, context: RequestContext): Promise<IntentResult> {
        const content = intent.data.content;
        if (!content) {
            return {
                success: false,
                error: 'Missing content to analyze'
            };
        }

        const options = intent.data.options || {};

        try {
            const result = await this.reasoner.reason(`Analyze the following content: ${content}`, {
                maxDepth: options.maxDepth || 3,
                methodOptions: options.methodOptions || {}
            });

            return {
                success: true,
                data: {
                    conclusion: result.conclusion,
                    confidence: result.confidence,
                    analysis: result.graph.nodes.map(node => node.content)
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Handle solve intent
     */
    private async handleSolve(intent: Intent, context: RequestContext): Promise<IntentResult> {
        const problem = intent.data.problem;
        if (!problem) {
            return {
                success: false,
                error: 'Missing problem to solve'
            };
        }

        const options = intent.data.options || {};

        try {
            const result = await this.reasoner.reason(problem, {
                maxDepth: options.maxDepth || 5,
                methodOptions: options.methodOptions || {}
            });

            return {
                success: true,
                data: {
                    solution: result.conclusion,
                    confidence: result.confidence,
                    reasoning: result.graph.nodes.map(node => node.content)
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
} 