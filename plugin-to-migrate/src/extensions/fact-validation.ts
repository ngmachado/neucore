import { IAgentRuntime, Memory, elizaLogger, stringToUuid, generateText, ModelClass, Evaluator } from "@elizaos/core";
import { AlfaFrensMessage } from "../types";

export interface FactValidation {
    confidence: number;
    source: string;
    timestamp: number;
    contradictions: string[];
    relationships?: Array<{
        sourceEntityId: string;
        targetEntityId: string;
        tags: string[];
        metadata?: {
            interactions: number;
        };
    }>;
}

export interface Contradiction {
    fact: string;
    existingFact: string;
    confidence: number;
    timestamp: number;
}

export interface MemoryPriority {
    importance: number;
    lastAccessed: number;
    accessCount: number;
}

export const factEvaluator: Evaluator = {
    name: "FACT_VALIDATION",
    similes: ["VALIDATE_FACTS", "CHECK_FACTS", "VERIFY_FACTS"],
    description: "Validates and stores factual information from conversations, tracking relationships and contradictions",
    examples: [
        {
            context: "User: I live in Seattle and work at Microsoft",
            messages: [
                { user: "user", content: { text: "I live in Seattle and work at Microsoft" } }
            ],
            outcome: `{
                "facts": [
                    { "claim": "User lives in Seattle", "type": "fact", "in_bio": false, "already_known": false },
                    { "claim": "User works at Microsoft", "type": "fact", "in_bio": false, "already_known": false }
                ],
                "relationships": [
                    { "sourceEntityId": "user-123", "targetEntityId": "microsoft", "tags": ["employment"] }
                ]
            }`
        }
    ],
    validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
        const messageCount = await runtime.messageManager.countMemories(message.roomId);
        const reflectionCount = Math.ceil(runtime.getConversationLength() / 2);
        return messageCount % reflectionCount === 0;
    },
    handler: async (runtime: IAgentRuntime, message: Memory) => {
        const manager = new FactValidationManager(runtime);
        const facts = await manager.extractFacts(message.content.text);
        const results = [];

        for (const fact of facts) {
            const validation = await manager.validateFact(fact, {
                id: message.id,
                timestamp: new Date().toISOString(),
                senderId: message.userId,
                senderUsername: message.userId,
                content: message.content.text
            });
            if (validation.confidence >= 0.7) {
                await manager.storeFact(fact, validation);
                results.push({
                    fact,
                    validation,
                    stored: true
                });
            } else {
                results.push({
                    fact,
                    validation,
                    stored: false
                });
            }
        }

        return { results };
    }
};

export class FactValidationManager {
    private runtime: IAgentRuntime;
    private confidenceThreshold: number = 0.7;

    constructor(runtime: IAgentRuntime) {
        this.runtime = runtime;
    }

    async extractFacts(content: string): Promise<string[]> {
        const prompt = `Extract factual statements from this text. Return ONLY a JSON array of strings.
        Only include clear, factual statements, not opinions or subjective content.
        The JSON array must be properly formatted with square brackets and quoted strings.
        
        Text: "${content}"
        
        Example format:
        ["Fact 1", "Fact 2", "Fact 3"]
        `;

        try {
            const result = await generateText({
                runtime: this.runtime,
                context: prompt,
                modelClass: ModelClass.SMALL,
            });

            elizaLogger.debug("[FactValidation] Raw fact extraction result:", result);

            // Find JSON array in the response using regex
            const jsonMatch = result.match(/\[.*\]/s);
            if (!jsonMatch) {
                elizaLogger.error("[FactValidation] No JSON array found in result:", result);
                return this.extractFactsFallback(content);
            }

            try {
                const jsonStr = jsonMatch[0];
                const facts = JSON.parse(jsonStr);

                if (!Array.isArray(facts)) {
                    elizaLogger.error("[FactValidation] Parsed result is not an array:", facts);
                    return this.extractFactsFallback(content);
                }

                // Filter out non-string items and empty strings
                const validFacts = facts.filter(fact => typeof fact === 'string' && fact.trim().length > 0);
                elizaLogger.debug("[FactValidation] Extracted facts:", validFacts);
                return validFacts;
            } catch (parseError) {
                elizaLogger.error("[FactValidation] Failed to parse JSON:", parseError);
                return this.extractFactsFallback(content);
            }
        } catch (error) {
            elizaLogger.error("[FactValidation] Error during fact extraction:", error);
            return this.extractFactsFallback(content);
        }
    }

    /**
     * Fallback method for fact extraction that uses simple heuristics
     * when LLM-based extraction fails
     */
    private extractFactsFallback(content: string): string[] {
        elizaLogger.debug("[FactValidation] Using fallback fact extraction");

        // Simple rule-based extraction of potential factual statements
        const sentences = content.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
        const potentialFacts = sentences.filter(sentence => {
            // Filter for sentences that look like factual statements
            // - Avoid questions
            // - Avoid sentences with opinion words
            // - Prefer sentences with dates, numbers, named entities
            const isQuestion = sentence.includes('?') ||
                sentence.toLowerCase().startsWith('what') ||
                sentence.toLowerCase().startsWith('who') ||
                sentence.toLowerCase().startsWith('when') ||
                sentence.toLowerCase().startsWith('where') ||
                sentence.toLowerCase().startsWith('why') ||
                sentence.toLowerCase().startsWith('how');

            const hasOpinionWords = /think|feel|believe|opinion|seem|appear|likely|possibly|maybe|perhaps/i.test(sentence);

            const hasFactSignals = /in \d{4}|\d{4}|founded|created|established|launched|developed|built|designed|is a|was born|located|headquartered/i.test(sentence);

            return !isQuestion && !hasOpinionWords && hasFactSignals;
        });

        elizaLogger.debug("[FactValidation] Fallback extracted facts:", potentialFacts);
        return potentialFacts;
    }

    async validateFact(fact: string, message: AlfaFrensMessage): Promise<FactValidation> {
        const existingFacts = await this.getRelevantFacts(fact);
        const contradictions = await this.detectContradictions(fact, existingFacts);
        const confidence = this.calculateFactConfidence(fact, message, contradictions);
        const relationships = await this.extractRelationships(fact, message);

        return {
            confidence,
            source: message.senderId,
            timestamp: Date.now(),
            contradictions: contradictions.map(c => c.fact),
            relationships
        };
    }

    private async getRelevantFacts(fact: string): Promise<Memory[]> {
        try {
            const memories = await this.runtime.messageManager.getMemories({
                roomId: this.runtime.agentId,
                count: 100
            });

            return memories.filter(memory =>
                this.calculateSemanticSimilarity(fact, memory.content.text) > 0.5
            );
        } catch (error) {
            elizaLogger.error("[FactValidation] Failed to get relevant facts:", error);
            return [];
        }
    }

    private async detectContradictions(fact: string, existingFacts: Memory[]): Promise<Contradiction[]> {
        const contradictions: Contradiction[] = [];

        for (const existingFact of existingFacts) {
            const similarity = this.calculateSemanticSimilarity(fact, existingFact.content.text);
            if (similarity > 0.8) {
                const contradiction = await this.analyzeContradiction(fact, existingFact.content.text);
                if (contradiction) {
                    contradictions.push({
                        fact,
                        existingFact: existingFact.content.text,
                        confidence: contradiction.confidence,
                        timestamp: Date.now()
                    });
                }
            }
        }

        return contradictions;
    }

    private async analyzeContradiction(fact1: string, fact2: string): Promise<{ confidence: number } | null> {
        const prompt = `Analyze if these two facts contradict each other:
        Fact 1: ${fact1}
        Fact 2: ${fact2}
        
        Return a JSON object with:
        {
            "contradicts": boolean,
            "confidence": number (0-1),
            "explanation": string
        }`;

        try {
            const result = await generateText({
                runtime: this.runtime,
                context: prompt,
                modelClass: ModelClass.SMALL,
            });

            const analysis = JSON.parse(result);
            if (analysis.contradicts && analysis.confidence > 0.7) {
                return { confidence: analysis.confidence };
            }
        } catch (error) {
            elizaLogger.error("[FactValidation] Failed to analyze contradiction:", error);
        }

        return null;
    }

    private async extractRelationships(fact: string, message: AlfaFrensMessage): Promise<FactValidation['relationships']> {
        const prompt = `Extract relationships from this fact. Return them as a JSON array of objects.
        Each object should have:
        {
            "sourceEntityId": string (the subject),
            "targetEntityId": string (the object),
            "tags": string[] (relationship types)
        }
        
        Fact: "${fact}"
        `;

        try {
            const result = await generateText({
                runtime: this.runtime,
                context: prompt,
                modelClass: ModelClass.SMALL,
            });

            return JSON.parse(result);
        } catch (error) {
            elizaLogger.error("[FactValidation] Failed to extract relationships:", error);
            return [];
        }
    }

    private calculateFactConfidence(
        fact: string,
        message: AlfaFrensMessage,
        contradictions: Contradiction[]
    ): number {
        let confidence = 0.5; // Base confidence

        // Adjust based on message source
        if (message.senderId === this.runtime.agentId) {
            confidence += 0.2; // Higher confidence for bot's own facts
        }

        // Adjust based on contradictions
        if (contradictions.length > 0) {
            const avgContradictionConfidence = contradictions.reduce(
                (acc, c) => acc + c.confidence,
                0
            ) / contradictions.length;
            confidence -= avgContradictionConfidence * 0.3;
        }

        // Ensure confidence is between 0 and 1
        return Math.max(0, Math.min(1, confidence));
    }

    private calculateSemanticSimilarity(text1: string, text2: string): number {
        const words1 = new Set(text1.toLowerCase().split(/\s+/));
        const words2 = new Set(text2.toLowerCase().split(/\s+/));

        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);

        return intersection.size / union.size;
    }

    async storeFact(fact: string, validation: FactValidation): Promise<void> {
        if (validation.confidence < this.confidenceThreshold) {
            elizaLogger.debug("[FactValidation] Skipping low confidence fact:", fact);
            return;
        }

        try {
            const memory: Memory = {
                id: stringToUuid(`fact-${Date.now()}`),
                content: {
                    text: fact,
                    metadata: {
                        confidence: validation.confidence,
                        source: validation.source,
                        timestamp: validation.timestamp,
                        contradictions: validation.contradictions,
                        relationships: validation.relationships
                    }
                },
                roomId: this.runtime.agentId,
                userId: this.runtime.agentId,
                agentId: this.runtime.agentId
            };

            await this.runtime.messageManager.createMemory(memory);
        } catch (error) {
            elizaLogger.error("[FactValidation] Failed to store fact:", error);
        }
    }
} 