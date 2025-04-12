/**
 * Evaluation types for the NeuroCore framework
 */

import { UUID } from "../types";
import { Content } from "./index";

/**
 * Example message for evaluation scenarios
 */
export interface EvaluationMessage {
    /** Message sender identifier */
    sender: string;

    /** Message content */
    content: Content;

    /** Optional action metadata */
    action?: string;
}

/**
 * Example for evaluation scenarios
 */
export interface EvaluationExample {
    /** Evaluation context */
    context: string;

    /** Example messages */
    messages: EvaluationMessage[];

    /** Expected outcome */
    outcome: string;
}

/**
 * Validator function for determining if an evaluator should run
 */
export type EvaluatorValidator = (context: any) => Promise<boolean>;

/**
 * Handler function to process evaluation results
 */
export type EvaluatorHandler = (context: any, result: any) => Promise<any>;

/**
 * Evaluator for assessing AI responses
 */
export interface Evaluator {
    /** Unique identifier */
    id: UUID;

    /** Display name */
    name: string;

    /** Detailed description */
    description: string;

    /** Similar descriptions of this evaluator */
    similes: string[];

    /** Example evaluation scenarios */
    examples: EvaluationExample[];

    /** Evaluation handler function */
    handler: EvaluatorHandler;

    /** Validation function */
    validate: EvaluatorValidator;

    /** Whether to always run this evaluator */
    alwaysRun?: boolean;

    /** Evaluation criteria as a template */
    criteria?: string;

    /** Metadata for the evaluator */
    metadata?: Record<string, any>;
} 