/**
 * Evaluation Manager for assessing AI responses
 */

import { v4 as uuidv4 } from 'uuid';
import { Evaluator, EvaluatorValidator, EvaluatorHandler } from '../../types/evaluation';
import { getLogger } from '../logging';
import { formatEvaluators, formatEvaluatorNames, formatEvaluatorExamples, parseJsonArrayFromText, processTemplate } from './evaluationUtils';
import { DEFAULT_RESPONSE_EVALUATION_TEMPLATE, EVALUATOR_SELECTION_TEMPLATE } from './templates';
import { UUID } from '../../types';

const logger = getLogger('EvaluationManager');

/**
 * Result of an evaluation
 */
export interface EvaluationResult {
    evaluatorId: UUID;
    evaluatorName: string;
    result: any;
    timestamp: Date;
    success: boolean;
    metadata?: Record<string, any>;
}

/**
 * Evaluation manager for assessing AI responses and behaviors
 */
export class EvaluationManager {
    /**
     * Registered evaluators
     */
    private evaluators: Map<string, Evaluator> = new Map();

    /**
     * LLM service for running evaluations
     */
    private llmService: any;

    /**
     * Create a new evaluation manager
     * @param llmService LLM service for running evaluations
     */
    constructor(llmService: any) {
        this.llmService = llmService;
        logger.debug('EvaluationManager initialized');
    }

    /**
     * Register a new evaluator
     * 
     * @param name Evaluator name
     * @param description Detailed description
     * @param validator Validation function
     * @param handler Handler function
     * @param options Additional options
     * @returns The registered evaluator
     */
    registerEvaluator(
        name: string,
        description: string,
        validator: EvaluatorValidator,
        handler: EvaluatorHandler,
        options: {
            similes?: string[];
            examples?: any[];
            alwaysRun?: boolean;
            criteria?: string;
            metadata?: Record<string, any>;
        } = {}
    ): Evaluator {
        const evaluator: Evaluator = {
            id: uuidv4() as UUID,
            name,
            description,
            validate: validator,
            handler,
            similes: options.similes || [],
            examples: options.examples || [],
            alwaysRun: options.alwaysRun || false,
            criteria: options.criteria,
            metadata: options.metadata
        };

        this.evaluators.set(evaluator.id, evaluator);
        logger.debug(`Registered evaluator: ${name}`);
        return evaluator;
    }

    /**
     * Unregister an evaluator
     * 
     * @param id Evaluator ID
     * @returns Success status
     */
    unregisterEvaluator(id: UUID): boolean {
        if (this.evaluators.has(id)) {
            this.evaluators.delete(id);
            logger.debug(`Unregistered evaluator: ${id}`);
            return true;
        }
        return false;
    }

    /**
     * Get all registered evaluators
     * 
     * @returns Array of evaluators
     */
    getEvaluators(): Evaluator[] {
        return Array.from(this.evaluators.values());
    }

    /**
     * Get an evaluator by ID
     * 
     * @param id Evaluator ID
     * @returns The evaluator or undefined if not found
     */
    getEvaluator(id: UUID): Evaluator | undefined {
        return this.evaluators.get(id);
    }

    /**
     * Evaluate whether a message requires a response
     * 
     * @param message Message to evaluate
     * @param template Optional custom template
     * @returns True if response is needed, false otherwise
     */
    async evaluateNeedsResponse(
        message: any,
        template: string = DEFAULT_RESPONSE_EVALUATION_TEMPLATE
    ): Promise<boolean> {
        try {
            logger.debug(`Evaluating if message needs response: ${JSON.stringify(message).substring(0, 100)}...`);

            // Process the template
            const processedTemplate = processTemplate(template, { message });

            // Generate the evaluation
            const response = await this.llmService.generateText(processedTemplate);

            // Parse the response
            const responseText = response.toLowerCase().trim();

            // Look for boolean indicators
            if (responseText.includes('true') && !responseText.includes('false')) {
                return true;
            } else if (responseText.includes('false') && !responseText.includes('true')) {
                return false;
            }

            // Check first line as fallback
            const firstLine = responseText.split('\n')[0].trim();
            if (firstLine === 'true') return true;
            if (firstLine === 'false') return false;

            // Default to respond if unclear
            logger.debug('Unclear evaluation, defaulting to respond');
            return true;
        } catch (error) {
            logger.error('Error evaluating message:', error);
            return false;
        }
    }

    /**
     * Run a specific evaluator
     * 
     * @param evaluatorId Evaluator ID
     * @param context Context for evaluation
     * @returns Evaluation result
     */
    async runEvaluator(evaluatorId: UUID, context: any): Promise<EvaluationResult> {
        const evaluator = this.evaluators.get(evaluatorId);
        if (!evaluator) {
            throw new Error(`Evaluator not found: ${evaluatorId}`);
        }

        logger.debug(`Running evaluator: ${evaluator.name}`);

        try {
            // Run the validation
            const shouldRun = await evaluator.validate(context);
            if (!shouldRun && !evaluator.alwaysRun) {
                logger.debug(`Evaluator ${evaluator.name} validation returned false, skipping`);
                return {
                    evaluatorId: evaluator.id,
                    evaluatorName: evaluator.name,
                    result: null,
                    timestamp: new Date(),
                    success: false,
                    metadata: { reason: 'Validation failed' }
                };
            }

            // Run the handler
            const result = await evaluator.handler(context, null);

            return {
                evaluatorId: evaluator.id,
                evaluatorName: evaluator.name,
                result,
                timestamp: new Date(),
                success: true
            };
        } catch (error) {
            logger.error(`Error running evaluator ${evaluator.name}:`, error);
            return {
                evaluatorId: evaluator.id,
                evaluatorName: evaluator.name,
                result: null,
                timestamp: new Date(),
                success: false,
                metadata: { error: (error as Error).message }
            };
        }
    }

    /**
     * Select and run appropriate evaluators for a context
     * 
     * @param context Context to evaluate
     * @param template Optional custom template
     * @returns Array of evaluation results
     */
    async evaluateWithApplicableEvaluators(
        context: any,
        template: string = EVALUATOR_SELECTION_TEMPLATE
    ): Promise<EvaluationResult[]> {
        // Get available evaluators
        const allEvaluators = this.getEvaluators();
        if (allEvaluators.length === 0) {
            logger.debug('No evaluators registered');
            return [];
        }

        try {
            // Format evaluator information
            const evaluatorsInfo = {
                evaluators: formatEvaluators(allEvaluators),
                evaluatorNames: formatEvaluatorNames(allEvaluators),
                evaluatorExamples: formatEvaluatorExamples(allEvaluators),
                ...context
            };

            // Process template
            const processedTemplate = processTemplate(template, evaluatorsInfo);

            // Generate evaluation to select evaluators
            const response = await this.llmService.generateText(processedTemplate);

            // Parse the response to get selected evaluator names
            const selectedEvaluatorNames = parseJsonArrayFromText(response);
            if (!selectedEvaluatorNames || selectedEvaluatorNames.length === 0) {
                logger.debug('No evaluators selected');
                return [];
            }

            logger.debug(`Selected evaluators: ${selectedEvaluatorNames.join(', ')}`);

            // Find evaluators by name
            const selectedEvaluators = allEvaluators.filter(evaluator =>
                selectedEvaluatorNames.includes(evaluator.name)
            );

            // Run each selected evaluator
            const results = await Promise.all(
                selectedEvaluators.map(evaluator => this.runEvaluator(evaluator.id, context))
            );

            return results;
        } catch (error) {
            logger.error('Error selecting/running evaluators:', error);
            return [];
        }
    }
} 