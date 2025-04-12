/**
 * Utility functions for evaluation
 */

import { Evaluator, EvaluationExample, EvaluationMessage } from '../../types/evaluation';
import { EVALUATOR_DESCRIPTION_TEMPLATE, EVALUATOR_EXAMPLE_TEMPLATE } from './templates';

/**
 * Format evaluators for display and selection
 * 
 * @param evaluators List of evaluators to format
 * @returns Formatted string describing the evaluators
 */
export function formatEvaluators(evaluators: Evaluator[]): string {
    return evaluators.map(evaluator => {
        let template = EVALUATOR_DESCRIPTION_TEMPLATE;
        template = template.replace('{{name}}', evaluator.name);
        template = template.replace('{{description}}', evaluator.description);
        template = template.replace('{{similes}}', evaluator.similes.join(', '));
        return template;
    }).join('\n\n');
}

/**
 * Format evaluator names for selection
 * 
 * @param evaluators List of evaluators
 * @returns Comma-separated list of evaluator names
 */
export function formatEvaluatorNames(evaluators: Evaluator[]): string {
    return evaluators.map(evaluator => evaluator.name).join(', ');
}

/**
 * Format evaluator examples for demonstration
 * 
 * @param evaluators List of evaluators with examples
 * @returns Formatted string with examples
 */
export function formatEvaluatorExamples(evaluators: Evaluator[]): string {
    return evaluators.map(evaluator => {
        return evaluator.examples.map(example => {
            let template = EVALUATOR_EXAMPLE_TEMPLATE;
            template = template.replace('{{context}}', example.context);

            const formattedMessages = example.messages
                .map((message: EvaluationMessage) => {
                    return `${message.sender}: ${message.content.text}${message.action ? ` (${message.action})` : ''}`;
                })
                .join('\n');

            template = template.replace('{{messages}}', formattedMessages);
            template = template.replace('{{outcome}}', example.outcome);

            return template;
        }).join('\n\n');
    }).join('\n\n');
}

/**
 * Parse JSON array from text response
 * 
 * @param text Text that should contain a JSON array
 * @returns Parsed array or null if parsing fails
 */
export function parseJsonArrayFromText(text: string): string[] | null {
    try {
        // Find bracket-enclosed content that looks like a JSON array
        const match = text.match(/\[([\s\S]*?)\]/);
        if (match) {
            // Try to parse the matched content
            const jsonText = match[0].replace(/'/g, '"');
            return JSON.parse(jsonText);
        }
        return null;
    } catch (error) {
        console.error('Error parsing JSON array from text:', error);
        return null;
    }
}

/**
 * Process a template by replacing placeholders with values
 * 
 * @param template Template string with placeholders
 * @param context Context object with values
 * @returns Processed template with placeholders replaced
 */
export function processTemplate(template: string, context: Record<string, any>): string {
    let result = template;

    // Find all placeholders in the template using regex
    const placeholders = template.match(/\{\{([^}]+)\}\}/g) || [];

    for (const placeholder of placeholders) {
        // Extract the path from the placeholder (e.g., "{{user.name}}" -> "user.name")
        const path = placeholder.substring(2, placeholder.length - 2).trim();

        // Split the path into segments
        const segments = path.split('.');

        // Traverse the context object following the path
        let value: any = context;
        for (const segment of segments) {
            if (value && typeof value === 'object' && segment in value) {
                value = value[segment];
            } else {
                value = undefined;
                break;
            }
        }

        // Replace the placeholder with the value (or empty string if undefined)
        result = result.replace(placeholder, value !== undefined ? String(value) : '');
    }

    return result;
} 