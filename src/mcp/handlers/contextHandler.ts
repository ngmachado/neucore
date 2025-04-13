/**
 * Context Handler
 * 
 * Provides context-building capabilities through the intent system.
 */

import { Intent } from '../intent';
import { IntentHandler, IntentResult } from '../intentHandler';
import { RequestContext } from '../interfaces/plugin';
import { MemoryManager } from '../../core/memory/memoryManager';
import { UUID } from '../../types';
import { IntentFilter } from '../intentFilter';
import { Memory, MemoryType } from '../../core/memory/types';

/**
 * Context building options
 */
interface ContextOptions {
    maxTokens?: number;
    maxItems?: number;
    recency?: number;
    relevanceThreshold?: number;
    includeTypes?: string[];
    generateSummary?: boolean;
    includeSummary?: boolean;
    summarizeThreshold?: number;
    storeSummary?: boolean;
}

/**
 * Summary item returned from the generator
 */
interface Summary {
    text: string;
    confidence: number;
    timeframe?: {
        start: Date;
        end: Date;
    };
}

/**
 * Context item structure for processing
 */
interface ContextItem {
    id: string;
    type: string;
    content: Record<string, any>;
    relevance: number;
    timestamp?: Date;
    tokens?: number;
}

/**
 * Handler for context-related intents
 */
export class ContextHandler implements IntentHandler {
    private memoryManager: MemoryManager;
    private logger: any;

    constructor(memoryManager: MemoryManager) {
        this.memoryManager = memoryManager;
        // Use console as logger
        this.logger = console;
    }

    /**
     * Get the intent filters for this handler
     */
    getIntentFilters(): IntentFilter[] {
        const filters: IntentFilter[] = [];

        // Context building filter
        const buildFilter = new IntentFilter(10);
        buildFilter.addAction('context:build');
        filters.push(buildFilter);

        // Context processing filter
        const processFilter = new IntentFilter(10);
        processFilter.addAction('context:process');
        filters.push(processFilter);

        return filters;
    }

    /**
     * Handle an intent
     */
    async handleIntent(intent: Intent, context: RequestContext): Promise<IntentResult> {
        try {
            switch (intent.action) {
                case 'context:build':
                    return this.handleBuildContext(intent, context);
                case 'context:retrieve':
                    return this.handleRetrieveContext(intent, context);
                case 'context:process':
                    return this.handleProcessContext(intent, context);
                default:
                    return {
                        success: false,
                        error: `Unsupported intent action: ${intent.action}`
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
     * Handle building context
     */
    private async handleBuildContext(intent: Intent, context: RequestContext): Promise<IntentResult> {
        const query = intent.data?.query;
        const userOptions = intent.data?.options || {};
        const roomId = intent.data?.roomId || context.roomId;
        const userId = context.userId;

        if (!query) {
            return {
                success: false,
                error: 'Query is required for context building'
            };
        }

        try {
            // Generate embedding for the query using the embedding provider
            const embedding = await this.getQueryEmbedding(query);

            // Define search options
            const searchOptions = {
                embedding,
                roomId,
                agentId: userOptions.agentId,
                matchThreshold: userOptions.relevanceThreshold || 0.7,
                count: userOptions.maxItems || 10,
                type: userOptions.includeTypes ? userOptions.includeTypes[0] : undefined
            };

            // Search for relevant memories
            const memories = await this.memoryManager.searchMemoriesByEmbedding(embedding, searchOptions);

            // Process memories to create context items
            const contextItems = this.processMemoriesForContext(memories, userOptions);

            // Generate a summary if requested
            let summary = null;
            if (userOptions.generateSummary) {
                summary = await this.generateSummary(memories, context, query);
            }

            return {
                success: true,
                data: {
                    contextItems,
                    summary,
                    count: contextItems.length
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
     * Generate embedding for a query string
     * @param query The text to generate an embedding for
     * @returns A vector embedding
     */
    private async getQueryEmbedding(query: string): Promise<number[]> {
        try {
            // Since we can't access the runtime directly, we'll use the memoryManager's
            // addEmbeddingToMemory method indirectly to get embeddings
            const tempMemory: Memory = {
                userId: 'temp' as UUID,
                roomId: 'temp' as UUID,
                content: { text: query },
                type: MemoryType.MESSAGE
            };

            const memoryWithEmbedding = await this.memoryManager.addEmbeddingToMemory(tempMemory);
            if (!memoryWithEmbedding.embedding) {
                throw new Error('Failed to generate embedding for query');
            }

            return memoryWithEmbedding.embedding;
        } catch (error) {
            throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Handle retrieving context
     */
    private async handleRetrieveContext(intent: Intent, context: RequestContext): Promise<IntentResult> {
        const { memoryIds } = intent.data || {};
        const userId = context.userId as UUID;

        if (!memoryIds || !Array.isArray(memoryIds) || memoryIds.length === 0) {
            return {
                success: false,
                error: 'Memory IDs array is required'
            };
        }

        try {
            const memories = await Promise.all(
                memoryIds.map(id => this.memoryManager.getMemoryById(id as UUID))
            );

            // Filter out any null results (not found)
            const validMemories = memories.filter(memory => memory !== null);

            return {
                success: true,
                data: {
                    memories: validMemories,
                    count: validMemories.length,
                    requested: memoryIds.length
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
     * Process memories for context building
     * @param memories Array of memories to process
     * @param userOptions User-provided options for context building
     * @returns Processed context items
     */
    private processMemoriesForContext(memories: Memory[], userOptions: ContextOptions): ContextItem[] {
        // Apply options for processing
        const maxTokens = userOptions.maxTokens || 4000;
        const maxItems = userOptions.maxItems || 10;

        // Sort memories by relevance if available, otherwise by timestamp
        let sortedMemories = [...memories];
        if (memories.length > 0 && memories[0].metadata?.relevance !== undefined) {
            sortedMemories.sort((a, b) => {
                const relevanceA = a.metadata?.relevance || 0;
                const relevanceB = b.metadata?.relevance || 0;
                return relevanceB - relevanceA; // Higher relevance first
            });
        } else {
            // Sort by timestamp (newest first)
            sortedMemories.sort((a, b) => {
                const timeA = a.createdAt || new Date(0);
                const timeB = b.createdAt || new Date(0);
                return timeB.getTime() - timeA.getTime();
            });
        }

        // Limit by max items
        sortedMemories = sortedMemories.slice(0, maxItems);

        // Calculate token estimates
        let totalTokens = 0;
        const tokenEstimates = sortedMemories.map(memory => {
            // Rough token estimation (4 chars = ~1 token)
            const contentText = memory.content.text || '';
            const tokens = Math.ceil(contentText.length / 4);
            return tokens;
        });

        // Keep memories within token limit
        const contextItems: ContextItem[] = [];
        for (let i = 0; i < sortedMemories.length; i++) {
            const memory = sortedMemories[i];
            const tokens = tokenEstimates[i];

            // Check if adding this memory would exceed token limit
            if (totalTokens + tokens > maxTokens) {
                break;
            }

            totalTokens += tokens;

            // Create context item
            contextItems.push({
                id: memory.id || '',
                type: memory.type || 'unknown',
                content: memory.content,
                relevance: memory.metadata?.relevance || 0,
                timestamp: memory.createdAt || (memory.content.timestamp instanceof Date ? memory.content.timestamp : undefined),
                tokens: tokens
            });
        }

        return contextItems;
    }

    /**
     * Generate a summary of memories
     * @param memories Array of memories to summarize
     * @param context Request context
     * @param query Original query that generated these memories
     * @returns A summary object with text and confidence
     */
    private async generateSummary(memories: Memory[], context: RequestContext, query: string): Promise<Summary> {
        // Extract timestamps for metadata
        const timestamps = memories.map(m => {
            if (m.createdAt) return m.createdAt.getTime();
            if (m.content.timestamp instanceof Date) return m.content.timestamp.getTime();
            return Date.now();
        });

        const oldestTimestamp = Math.min(...timestamps);
        const newestTimestamp = Math.max(...timestamps);

        // Extract memory content for summarization
        const memoryTexts = memories.map(m => {
            const sender = m.content.sender ? `${m.content.sender}: ` : '';
            const timestamp = m.createdAt ?
                `[${m.createdAt.toISOString()}] ` :
                (m.content.timestamp instanceof Date ?
                    `[${m.content.timestamp.toISOString()}] ` : '');

            return `${timestamp}${sender}${m.content.text || ''}`;
        }).join('\n\n');

        // Use reasoning intent to generate the summary if available
        try {
            const reasoningIntent = new Intent('reasoning:solve', {
                problem: `Generate a concise summary of these ${memories.length} items related to "${query}". Focus on the key points and insights.`,
                context: memoryTexts,
                options: {
                    maxTokens: 200,
                    temperature: 0.3
                }
            });

            // Execute the intent through MCP if available
            if (context.mcp) {
                const result = await context.mcp.executeIntent(reasoningIntent);
                if (result.success && result.data?.solution) {
                    return {
                        text: result.data.solution,
                        confidence: result.data.confidence || 0.8,
                        timeframe: {
                            start: new Date(oldestTimestamp),
                            end: new Date(newestTimestamp)
                        }
                    };
                }
            }

            // Fallback summary generation
            return this.generateFallbackSummary(memories, query, oldestTimestamp, newestTimestamp);
        } catch (error) {
            // If reasoning fails, use fallback
            return this.generateFallbackSummary(memories, query, oldestTimestamp, newestTimestamp);
        }
    }

    /**
     * Generate a fallback summary when reasoning is unavailable
     */
    private generateFallbackSummary(memories: Memory[], query: string, oldestTimestamp: number, newestTimestamp: number): Summary {
        // Extract key topics - take up to 5 most common words from memory texts
        const wordFrequency: { [key: string]: number } = {};
        const stopWords = new Set(['the', 'and', 'a', 'an', 'in', 'to', 'of', 'is', 'that', 'for', 'on', 'with']);

        memories.forEach(memory => {
            const text = memory.content.text || '';
            const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !stopWords.has(w));

            words.forEach(word => {
                wordFrequency[word] = (wordFrequency[word] || 0) + 1;
            });
        });

        // Sort by frequency and take top 5
        const topics = Object.entries(wordFrequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([word]) => word);

        // Generate fallback summary text
        const dateRange = oldestTimestamp !== newestTimestamp ?
            `from ${new Date(oldestTimestamp).toLocaleDateString()} to ${new Date(newestTimestamp).toLocaleDateString()}` :
            `from ${new Date(oldestTimestamp).toLocaleDateString()}`;

        return {
            text: `Summary of ${memories.length} items related to "${query}" ${dateRange}. Key topics: ${topics.join(', ')}. Contains ${memories.filter(m => m.type === 'message').length} messages and ${memories.filter(m => m.type !== 'message').length} other items.`,
            confidence: 0.6,
            timeframe: {
                start: new Date(oldestTimestamp),
                end: new Date(newestTimestamp)
            }
        };
    }

    /**
     * Create a summary memory based on context items
     * @param memories Array of memories to summarize
     * @param context Request context
     * @param query Original query that generated these memories
     * @param options Options for summary creation
     */
    private async createSummaryMemory(memories: Memory[], context: RequestContext, query: string, options: ContextOptions): Promise<IntentResult> {
        try {
            const userId = context.userId;
            const roomId = context.roomId;

            // Get oldest and newest timestamps from memories if available
            const timestamps = memories.map(m => {
                if (m.createdAt) return m.createdAt.getTime();
                if (m.content.timestamp instanceof Date) return m.content.timestamp.getTime();
                return Date.now();
            });

            const oldestTimestamp = Math.min(...timestamps);
            const newestTimestamp = Math.max(...timestamps);

            // Create summary memory
            const summaryMemory: Memory = {
                userId: userId as UUID,
                roomId: roomId as UUID,
                type: MemoryType.SUMMARY,
                content: {
                    text: `Summary of ${memories.length} items related to "${query}"`,
                    query,
                    memoryCount: memories.length,
                    timeframe: {
                        start: new Date(oldestTimestamp),
                        end: new Date(newestTimestamp)
                    }
                },
                metadata: {
                    memoryIds: memories.map(m => m.id || '').filter(Boolean)
                }
            };

            // Store the summary
            await this.memoryManager.createMemory(summaryMemory);

            return {
                success: true,
                data: {
                    summaryId: summaryMemory.id || 'generated-summary-id',
                    summaryText: summaryMemory.content.text
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            }
        }
    }

    private async handleProcessContext(intent: Intent, context: RequestContext): Promise<IntentResult> {
        const { contextItems, query, options } = intent.data || {};

        // Validate required input data
        if (!contextItems || !Array.isArray(contextItems) || contextItems.length === 0) {
            return {
                success: false,
                error: 'Context items array is required and must not be empty'
            };
        }

        if (!query) {
            return {
                success: false,
                error: 'Query is required for context processing'
            };
        }

        // Process with default options if none provided
        const contextOptions: ContextOptions = options || {
            maxTokens: 4000,
            maxItems: 10,
            includeSummary: true,
            summarizeThreshold: 5
        };

        try {
            // Process context items
            const processedItems = this.processMemoriesForContext(contextItems, contextOptions);

            // Generate summary if needed
            let summary: Summary | null = null;
            if (contextOptions.includeSummary && contextItems.length >= (contextOptions.summarizeThreshold || 5)) {
                summary = await this.generateSummary(contextItems, context, query);

                // Create a summary memory if requested
                if (contextOptions.storeSummary) {
                    const summaryResult = await this.createSummaryMemory(contextItems, context, query, contextOptions);
                    if (summaryResult.success && summaryResult.data?.summaryId) {
                        this.logger.debug('Created summary memory', { summaryId: summaryResult.data.summaryId });
                    }
                }
            }

            // Calculate token usage
            const totalTokens = processedItems.reduce((sum, item) => sum + (item.tokens || 0), 0);

            // Return processed context
            return {
                success: true,
                data: {
                    contextItems: processedItems,
                    tokenCount: totalTokens,
                    itemCount: processedItems.length,
                    summary: summary || undefined,
                    contextComplete: true
                }
            };
        } catch (error) {
            this.logger.error('Error processing context:', error);

            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                data: {
                    contextComplete: false,
                    errorTimestamp: new Date().toISOString()
                }
            };
        }
    }
} 