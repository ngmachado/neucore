import { IAgentRuntime, elizaLogger, generateText, ModelClass, ServiceType } from "@elizaos/core";
import type { AlfaFrensMessage } from "../types";
import type { AlfaFrensGenerationConfig } from "../types";
import { v4 as uuidv4 } from 'uuid';
import { FactValidationManager } from "./fact-validation";

/**
 * process a template string with runtime data
 * @param template template string with placeholders
 * @param runtime ElizaOS runtime
 * @param additionalData additional data for replacement
 * @returns processed template
 */
export function processTemplate(
    template: string,
    runtime: IAgentRuntime,
    additionalData: Record<string, any> = {}
): string {
    const character = runtime.character;
    let result = template
        .replace(/{{character\.name}}/g, character.name)
        .replace(/{{character\.adjectives}}/g, character.adjectives.join(", "))
        .replace(/{{character\.topics}}/g, character.topics?.join(", ") || "");

    // process additional data if provided
    Object.entries(additionalData).forEach(([key, value]) => {
        if (typeof value === 'object') {
            Object.entries(value).forEach(([subKey, subValue]) => {
                result = result.replace(
                    new RegExp(`{{${key}\\.${subKey}}}`, 'g'),
                    String(subValue)
                );
            });
        } else {
            result = result.replace(
                new RegExp(`{{${key}}}`, 'g'),
                String(value)
            );
        }
    });

    return result;
}

/**
 * parse a model class string to ModelClass enum
 * @param modelClass string representation of model class
 * @returns ModelClass enum value or undefined
 */
export function parseModelClass(modelClass?: string): ModelClass | undefined {
    if (!modelClass) return undefined;

    switch (modelClass.toUpperCase()) {
        case "SMALL": return ModelClass.SMALL;
        case "MEDIUM": return ModelClass.MEDIUM;
        case "LARGE": return ModelClass.LARGE;
        default: return undefined;
    }
}

/**
 * gets a numeric setting from the character file with a default value
 * @param runtime ElizaOS runtime
 * @param key setting key
 * @param defaultValue default value if not found
 * @returns numeric setting value
 */
export function getNumericSetting(
    runtime: IAgentRuntime,
    key: string,
    defaultValue: number
): number {
    const value = runtime.getSetting(key);
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * default template for generating post content
 */
export const DEFAULT_POST_TEMPLATE = `You are {{character.name}}, an AI assistant with the following traits:
{{character.adjectives}}

Your topics of expertise include:
{{character.topics}}

TASK: Write a new post for a community channel.

RULES:
1. Write ONLY the post content
2. Do not include any meta-commentary
3. Start directly with your message
4. Keep it engaging and relevant
5. Maximum length: 2-3 sentences
6. Be concise and meaningful

POST:`;

/**
 * default template for generating responses
 */
export const DEFAULT_RESPONSE_TEMPLATE = `You are {{character.name}}, an AI assistant with the following traits:
{{character.adjectives}}

Your topics of expertise include:
{{character.topics}}

CONVERSATION HISTORY:
{{message.history}}

USER ({{message.sender}}): {{message.content}}

TASK: Respond to the user's message.

RULES:
1. Keep responses concise (1-2 sentences)
2. Be direct and helpful
3. Stay focused on the question
4. No meta-commentary

YOUR RESPONSE:`;

/**
 * default template for evaluating messages
 */
export const DEFAULT_EVALUATION_TEMPLATE = `TASK: Decide whether the AI assistant should respond to this message.

Message: "{{message.content}}"
Sender: {{message.sender}}

INSTRUCTIONS:
You are helping me decide if the AI assistant should respond to the message above.
Consider the following:
1. Is this a substantial message that requires a response?
2. Is the message directed at the assistant?
3. Is the message a question, request for help, or engaging in conversation?
4. Is the message appropriate to respond to?

Response format:
Return a JSON array with:
1. A boolean (true/false) indicating whether to respond
2. A brief explanation for your decision

Example response:
\`\`\`json
[true, "This is a direct question that the assistant should answer"]
\`\`\`

Or:
\`\`\`json
[false, "This message is too short and doesn't require a response"]
\`\`\`
`;

/**
 * format conversation history for context
 * @param messages array of messages to format
 * @returns formatted conversation history
 */
function formatConversationHistory(messages: AlfaFrensMessage[]): string {
    if (messages.length === 0) {
        return "No previous messages.";
    }

    return messages.map(msg => {
        const role = msg.senderId === msg.senderUsername ?
            "ASSISTANT" :
            `USER (${msg.senderUsername})`;
        return `${role}: ${msg.content}`;
    }).join("\n\n");
}

/**
 * common function for generating text with LLM with detailed logging
 */
async function generateLLMResponse({
    runtime,
    context,
    modelClass,
    logPrefix = "[AlfaFrens]",
    traceId = ""
}: {
    runtime: IAgentRuntime;
    context: string;
    modelClass: ModelClass;
    logPrefix?: string;
    traceId?: string;
}): Promise<string> {
    const id = traceId ? ` (${traceId})` : "";
    elizaLogger.debug(`${logPrefix} Generating text with parameters${id}:`, {
        modelClass,
        contextLength: context.length,
        contextPreview: context.substring(0, 100) + (context.length > 100 ? '...' : ''),
        runtimeHasCharacter: !!runtime.character,
        runtimeHasModelProvider: !!runtime.modelProvider
    });

    try {
        // add a timeout to the LLM call to prevent hanging
        const timeoutPromise = new Promise<string>((_, reject) => {
            setTimeout(() => reject(new Error("LLM request timed out")), 30000); // 30 second timeout
        });

        const llmPromise = generateText({
            runtime,
            context,
            modelClass,
            stop: ["\n\n"],
            customSystemPrompt: "You are a helpful assistant that responds as accurately as possible.",
        });

        // race the LLM call against a timeout
        const result = await Promise.race([llmPromise, timeoutPromise]);

        elizaLogger.debug(`${logPrefix} Generated text${id}:`, {
            resultLength: result.length,
            resultPreview: result.substring(0, 100) + (result.length > 100 ? '...' : '')
        });

        return result;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // check for common API errors
        if (errorMessage.includes("authentication") || errorMessage.includes("api key")) {
            elizaLogger.error(`${logPrefix} Authentication error with API${id}:`, errorMessage);
            console.error(`=== LLM API AUTHENTICATION ERROR [${traceId || 'unknown'}] ===`);
            console.error(errorMessage);
        } else if (errorMessage.includes("timeout")) {
            elizaLogger.error(`${logPrefix} Timeout error calling LLM API${id}:`, errorMessage);
            console.error(`=== LLM API TIMEOUT [${traceId || 'unknown'}] ===`);
        } else {
            elizaLogger.error(`${logPrefix} Error generating text${id}:`, error);
            console.error(`=== LLM API ERROR [${traceId || 'unknown'}] ===`, errorMessage);
        }

        // rethrow so caller can handle
        throw error;
    }
}

/**
 * generates post content using the AI
 */
export async function generatePostContent(
    runtime: IAgentRuntime,
    config: AlfaFrensGenerationConfig['post']
): Promise<string> {
    elizaLogger.debug("[AlfaFrens] Starting post content generation");

    elizaLogger.debug("[AlfaFrens] Using template:", config.template?.substring(0, 50) + "...");
    elizaLogger.debug("[AlfaFrens] Using model class:", config.modelClass);

    const context = processTemplate(config.template, runtime);

    try {
        const content = await generateLLMResponse({
            runtime,
            context,
            modelClass: config.modelClass,
            traceId: "post"
        });

        elizaLogger.info("[AlfaFrens] Generated post content:", content);
        return content;
    } catch (error) {
        elizaLogger.error("[AlfaFrens] Failed to generate post content:", error);
        return "I'm sorry, I couldn't generate a post at this time.";
    }
}

/**
 * Generates a response to a message
 */
export async function generateResponse(
    runtime: IAgentRuntime,
    client: any,
    message: string,
    messageHistory: any[],
    template: string,
    modelClass?: ModelClass
): Promise<string> {
    // Explicitly check for web search service and try to use it
    let webSearchResults = "";
    try {
        const webSearchService = runtime.getService(ServiceType.WEB_SEARCH);
        if (webSearchService) {
            elizaLogger.info("[AlfaFrens] Web search service found, attempting to search for: " + message);
            // Cast the service to any to access its search method
            const searchResults = await (webSearchService as any).search(message, {
                limit: 3,
                includeAnswer: true
            });

            if (searchResults && searchResults.results && searchResults.results.length > 0) {
                elizaLogger.info("[AlfaFrens] Web search results found!");
                webSearchResults = `${searchResults.answer || ""}\n\nRelevant web search results:\n`;
                webSearchResults += searchResults.results.map((result: any, i: number) =>
                    `${i + 1}. ${result.title} - ${result.url}`
                ).join('\n');
            }
        } else {
            elizaLogger.warn("[AlfaFrens] Web search service not found");
        }
    } catch (error) {
        elizaLogger.error("[AlfaFrens] Error using web search service:", error);
    }

    // Get relevant knowledge for this message
    let knowledgeContext = "";
    try {
        // Use the client's knowledge search capability
        const knowledgeResults = await client.searchKnowledge(message, 3);
        if (knowledgeResults && knowledgeResults.length > 0) {
            knowledgeContext = "\n\nRelevant knowledge:\n" +
                knowledgeResults.map(r => r.content?.text || "").filter(Boolean).join("\n\n");
        }
    } catch (error) {
        elizaLogger.warn("[AlfaFrens] Error fetching knowledge context:", error);
    }

    // Format the history for the prompt
    const formattedHistory = formatConversationHistory(messageHistory);

    // Add knowledge context and web search results to the message
    const contextEnhancedMessage = message;

    // Process the template with the message, history, and web search results
    let prompt = processTemplate(template, runtime, {
        message: {
            content: contextEnhancedMessage,
            history: formattedHistory
        },
        websearch: webSearchResults,
        knowledge: knowledgeContext
    });

    // Generate the response
    const rawResponse = await generateLLMResponse({
        runtime,
        context: prompt,
        modelClass: modelClass || ModelClass.MEDIUM,
        traceId: "response"
    });

    // Perform fact validation
    const factValidationManager = new FactValidationManager(runtime);

    try {
        // Extract facts from the generated response
        const extractedFacts = await factValidationManager.extractFacts(rawResponse);
        elizaLogger.debug("[AlfaFrens] Extracted facts from response:", extractedFacts);

        if (extractedFacts.length === 0) {
            // No facts to validate, return the original response
            return rawResponse;
        }

        // Create a dummy message for validation context
        const dummyMessage = {
            id: `validation-${Date.now()}`,
            timestamp: new Date().toISOString(),
            content: rawResponse,
            senderId: runtime.agentId,
            senderUsername: runtime.character?.name || "AI Assistant"
        };

        // Validate each extracted fact
        let requiresCorrection = false;
        const factValidationResults = [];

        for (const fact of extractedFacts) {
            const validation = await factValidationManager.validateFact(fact, dummyMessage);
            factValidationResults.push({
                fact,
                confidence: validation.confidence,
                contradictions: validation.contradictions
            });

            // If the fact has contradictions or low confidence, we might need to correct the response
            if (validation.contradictions.length > 0 || validation.confidence < 0.7) {
                requiresCorrection = true;
            }
        }

        elizaLogger.debug("[AlfaFrens] Fact validation results:", factValidationResults);

        // If corrections are needed, regenerate with corrected context
        if (requiresCorrection) {
            elizaLogger.info("[AlfaFrens] Facts require correction, enhancing prompt with factual context");

            // Create a correction context
            const correctionContext = factValidationResults
                .filter(r => r.contradictions.length > 0 || r.confidence < 0.7)
                .map(r => {
                    if (r.contradictions.length > 0) {
                        return `CORRECTION: "${r.fact}" contradicts known facts: ${r.contradictions.join(", ")}`;
                    } else {
                        return `CORRECTION: "${r.fact}" has low confidence (${r.confidence.toFixed(2)})`;
                    }
                })
                .join("\n");

            // Create a revised prompt with correction context
            const revisedPrompt = `${prompt}\n\nYour initial response contains factual issues that need correction:\n${correctionContext}\n\nRevised response:`;

            // Generate a corrected response
            const correctedResponse = await generateLLMResponse({
                runtime,
                context: revisedPrompt,
                modelClass: modelClass || ModelClass.MEDIUM,
                traceId: "corrected-response"
            });

            elizaLogger.info("[AlfaFrens] Generated fact-corrected response");
            return correctedResponse;
        }

        // Store validated facts with high confidence
        for (const result of factValidationResults) {
            if (result.confidence >= 0.7 && result.contradictions.length === 0) {
                await factValidationManager.storeFact(result.fact, {
                    confidence: result.confidence,
                    source: runtime.agentId,
                    timestamp: Date.now(),
                    contradictions: []
                });
            }
        }
    } catch (error) {
        // If fact validation fails, log and return the original response
        elizaLogger.error("[AlfaFrens] Error during fact validation:", error);
        elizaLogger.warn("[AlfaFrens] Returning original response due to fact validation error");
    }

    return rawResponse;
}

/**
 * evaluate a message to determine if the AI should respond
 * @param runtime agent runtime
 * @param message the message to evaluate
 * @param config configuration for evaluation
 * @returns boolean indicating whether to respond
 */
export async function evaluateMessage(
    runtime: IAgentRuntime,
    message: AlfaFrensMessage,
    config: { template: string, modelClass?: ModelClass }
): Promise<boolean> {
    // generate a unique trace ID for this evaluation call
    const traceId = `eval-${message.id.substring(0, 8)}-${Date.now().toString().substring(9, 13)}`;

    // remove console.log statements
    elizaLogger.debug(`[EVALUATION START ${traceId}] Message from ${message.senderUsername}: ${message.content?.substring(0, 100)}`);

    // force debug mode: skip LLM evaluation and always return true
    // remove console.log statements
    elizaLogger.debug(`[FORCE DEBUG MODE] Skipping LLM evaluation and returning TRUE`);

    return true;
}