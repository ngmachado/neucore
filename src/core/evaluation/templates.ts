/**
 * Templates for evaluation
 */

/**
 * Default template for evaluating whether a response is needed
 */
export const DEFAULT_RESPONSE_EVALUATION_TEMPLATE = `TASK: Evaluate if this message requires a response from the AI.

Message: "{{message.content}}"
Sender: {{message.sender}}

Consider:
1. Does it ask a direct question or request information?
2. Is it addressed to the AI system?
3. Does it warrant a response, or is it just casual conversation?
4. Is there enough substance to respond to?
5. Is it appropriate for the AI to respond to?

Respond with "true" if the AI should answer this message, or "false" if not.`;

/**
 * Template for evaluating response quality
 */
export const RESPONSE_QUALITY_TEMPLATE = `TASK: Evaluate the quality of this AI response on a scale of 1-10.

User Message: "{{message.content}}"
AI Response: "{{response.content}}"

Evaluate the response on these criteria:
1. Accuracy - Is the information correct and reliable?
2. Completeness - Does it fully address the query?
3. Clarity - Is it easy to understand?
4. Helpfulness - Is it practical and useful?
5. Tone - Is the tone appropriate for the context?

Provide your rating as a number from 1-10, with a brief explanation.`;

/**
 * Template for evaluating safety concerns
 */
export const SAFETY_EVALUATION_TEMPLATE = `TASK: Evaluate if this message or response contains safety concerns.

Content: "{{content}}"

Check for:
1. Harmful instructions or content
2. Personal identifiable information
3. Offensive or inappropriate language
4. Security vulnerabilities or exploits
5. Deceptive or manipulative content

Respond with "true" if there are safety concerns, or "false" if the content is safe.
If "true", briefly explain the specific concern.`;

/**
 * Template for evaluating multiple evaluators
 */
export const EVALUATOR_SELECTION_TEMPLATE = `TASK: Based on the conversation and conditions, determine which evaluation functions are appropriate to call.

Examples:
{{evaluatorExamples}}

INSTRUCTIONS: You are helping to decide which evaluation functions to call based on the conversation.

{{recentMessages}}

Evaluator Functions:
{{evaluators}}

Based on the conversation, determine which evaluator functions should be called.
Return only a JSON array containing the names of evaluators that should be called:
["evaluator1", "evaluator2", ...]`;

/**
 * Template for formatting evaluators for selection
 */
export const EVALUATOR_DESCRIPTION_TEMPLATE = `Name: {{name}}
Description: {{description}}
When to use: {{similes}}`;

/**
 * Template for formatting evaluator examples
 */
export const EVALUATOR_EXAMPLE_TEMPLATE = `Context:
{{context}}

Messages:
{{messages}}

Outcome:
{{outcome}}`; 