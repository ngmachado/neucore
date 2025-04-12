/**
 * Unified Context Builder for NeuroCore
 * 
 * This module provides integrated context assembly for AI models,
 * pulling from multiple sources like memory, RAG, goals, and more.
 */

import { UUID } from '../../types';

/**
 * Context source types
 */
export enum ContextSourceType {
    MEMORY = 'memory',
    KNOWLEDGE = 'knowledge',
    CONVERSATION = 'conversation',
    GOALS = 'goals',
    SYSTEM = 'system',
    USER_PROFILE = 'user_profile',
    CURRENT_STATE = 'current_state',
}

/**
 * Context source configuration
 */
export interface ContextSourceConfig {
    /**
     * Type of context source
     */
    type: ContextSourceType;

    /**
     * Maximum tokens to allocate to this source
     */
    maxTokens?: number;

    /**
     * Priority of this source (higher = more important)
     */
    priority: number;

    /**
     * Whether this source is required for context
     */
    required: boolean;

    /**
     * Query to use when retrieving from this source
     */
    query?: string;

    /**
     * Additional parameters for this source
     */
    params?: Record<string, any>;
}

/**
 * Context item from a specific source
 */
export interface ContextItem {
    /**
     * Type of context source
     */
    sourceType: ContextSourceType;

    /**
     * Content of the context item
     */
    content: string;

    /**
     * Metadata about this context item
     */
    metadata?: Record<string, any>;

    /**
     * Estimated token count
     */
    tokenCount?: number;

    /**
     * Relevance score (0-1)
     */
    relevanceScore?: number;
}

/**
 * Assembled context ready for model input
 */
export interface AssembledContext {
    /**
     * System message/instructions
     */
    system?: string;

    /**
     * Context items to include
     */
    items: ContextItem[];

    /**
     * Total estimated token count
     */
    totalTokens: number;

    /**
     * Whether context was truncated due to token limits
     */
    truncated: boolean;
}

/**
 * Context builder options
 */
export interface ContextBuildOptions {
    /**
     * Maximum tokens for the entire context
     */
    maxTokens?: number;

    /**
     * Context sources to include
     */
    sources?: ContextSourceConfig[];

    /**
     * Whether to prioritize recent items
     */
    prioritizeRecent?: boolean;

    /**
     * Whether to deduplicate similar items
     */
    deduplicate?: boolean;

    /**
     * User to build context for
     */
    userId?: UUID;

    /**
     * Agent ID to build context for
     */
    agentId?: UUID;

    /**
     * Current conversation ID
     */
    conversationId?: UUID;
}

/**
 * Unified context builder class
 */
export class ContextBuilder {
    private memoryManager: any; // Replace with proper type
    private ragManager: any; // Replace with proper type
    private goalsManager: any; // Replace with proper type
    private userProfileManager: any; // Replace with proper type
    private logger: any; // Replace with proper type

    /**
     * Create a new context builder
     */
    constructor(dependencies: {
        memoryManager?: any;
        ragManager?: any;
        goalsManager?: any;
        userProfileManager?: any;
        logger?: any;
    }) {
        this.memoryManager = dependencies.memoryManager;
        this.ragManager = dependencies.ragManager;
        this.goalsManager = dependencies.goalsManager;
        this.userProfileManager = dependencies.userProfileManager;
        this.logger = dependencies.logger || console;
    }

    /**
     * Build context from multiple sources
     * 
     * @param query The user query to build context for
     * @param options Context building options
     * @returns Assembled context for the model
     */
    async buildContext(
        query: string,
        options: ContextBuildOptions = {}
    ): Promise<AssembledContext> {
        const maxTokens = options.maxTokens || 8000;
        const sources = options.sources || this.getDefaultSources();

        // Initialize context structure
        const context: AssembledContext = {
            items: [],
            totalTokens: 0,
            truncated: false
        };

        try {
            // Sort sources by priority
            const sortedSources = [...sources].sort((a, b) => b.priority - a.priority);

            // Collect items from all sources in parallel
            const itemPromises = sortedSources.map(source =>
                this.getItemsFromSource(source, query, options)
            );

            const itemsBySource = await Promise.all(itemPromises);

            // Flatten and pre-sort all items by relevance score and priority
            let allItems: Array<ContextItem & { sourcePriority: number }> = [];

            itemsBySource.forEach((items, index) => {
                const sourcePriority = sortedSources[index].priority;
                items.forEach(item => {
                    allItems.push({
                        ...item,
                        sourcePriority
                    });
                });
            });

            // Sort by both relevance and priority
            allItems.sort((a, b) => {
                // Primary sort by sourcePriority
                const priorityDiff = b.sourcePriority - a.sourcePriority;
                if (priorityDiff !== 0) return priorityDiff;

                // Secondary sort by relevance
                return (b.relevanceScore || 0) - (a.relevanceScore || 0);
            });

            // Deduplicate if needed
            if (options.deduplicate) {
                allItems = this.deduplicateItems(allItems);
            }

            // Allocate tokens to items based on priority and limits
            let remainingTokens = maxTokens;
            const selectedItems: Array<ContextItem & { sourcePriority: number }> = [];

            // First, include all required items
            for (const source of sortedSources.filter(s => s.required)) {
                const sourceItems = allItems.filter(item =>
                    item.sourceType === source.type &&
                    (item.tokenCount || 0) <= remainingTokens
                );

                if (sourceItems.length > 0) {
                    // Take the most relevant item if there are multiple
                    const item = sourceItems[0];
                    selectedItems.push(item);
                    remainingTokens -= item.tokenCount || 0;

                    // Remove this item from allItems to avoid duplication
                    allItems = allItems.filter(i => i !== item);
                }
            }

            // Then fill with other items until we hit the token limit
            for (const item of allItems) {
                const tokenCount = item.tokenCount || 0;
                if (tokenCount <= remainingTokens) {
                    selectedItems.push(item);
                    remainingTokens -= tokenCount;
                } else {
                    context.truncated = true;
                }

                // Stop if we're out of tokens
                if (remainingTokens <= 0) {
                    context.truncated = true;
                    break;
                }
            }

            // Set final context items and metadata
            context.items = selectedItems.map(({ sourcePriority, ...item }) => item);
            context.totalTokens = maxTokens - remainingTokens;

            // Generate system message if needed
            if (options.userId || options.agentId) {
                context.system = await this.generateSystemMessage(options);
            }

            return context;
        } catch (error) {
            this.logger.error('Error building context:', error);
            // Return minimal working context on error
            return {
                items: [],
                totalTokens: 0,
                truncated: false
            };
        }
    }

    /**
     * Get default context sources
     */
    private getDefaultSources(): ContextSourceConfig[] {
        return [
            {
                type: ContextSourceType.CONVERSATION,
                priority: 100,
                required: true
            },
            {
                type: ContextSourceType.GOALS,
                priority: 90,
                required: false
            },
            {
                type: ContextSourceType.MEMORY,
                priority: 80,
                required: false
            },
            {
                type: ContextSourceType.KNOWLEDGE,
                priority: 70,
                required: false
            },
            {
                type: ContextSourceType.USER_PROFILE,
                priority: 60,
                required: false
            },
            {
                type: ContextSourceType.SYSTEM,
                priority: 50,
                required: true
            }
        ];
    }

    /**
     * Get context items from a specific source
     */
    private async getItemsFromSource(
        source: ContextSourceConfig,
        query: string,
        options: ContextBuildOptions
    ): Promise<ContextItem[]> {
        try {
            switch (source.type) {
                case ContextSourceType.MEMORY:
                    return this.getMemoryItems(source, query, options);
                case ContextSourceType.KNOWLEDGE:
                    return this.getKnowledgeItems(source, query, options);
                case ContextSourceType.CONVERSATION:
                    return this.getConversationItems(source, query, options);
                case ContextSourceType.GOALS:
                    return this.getGoalsItems(source, query, options);
                case ContextSourceType.USER_PROFILE:
                    return this.getUserProfileItems(source, query, options);
                case ContextSourceType.SYSTEM:
                    return this.getSystemItems(source, query, options);
                default:
                    return [];
            }
        } catch (error) {
            this.logger.error(`Error getting items from ${source.type}:`, error);
            return [];
        }
    }

    /**
     * Get memory items
     */
    private async getMemoryItems(
        source: ContextSourceConfig,
        query: string,
        options: ContextBuildOptions
    ): Promise<ContextItem[]> {
        if (!this.memoryManager) return [];

        // Implement memory retrieval logic
        // ...

        return [];
    }

    /**
     * Get knowledge items from RAG
     */
    private async getKnowledgeItems(
        source: ContextSourceConfig,
        query: string,
        options: ContextBuildOptions
    ): Promise<ContextItem[]> {
        if (!this.ragManager) return [];

        try {
            const searchParams = {
                query,
                agentId: options.agentId,
                maxResults: source.params?.maxResults || 5,
                minSimilarity: source.params?.minSimilarity || 0.75
            };

            const searchResults = await this.ragManager.searchKnowledge(searchParams);

            return searchResults.map((item: any) => ({
                sourceType: ContextSourceType.KNOWLEDGE,
                content: item.content,
                metadata: {
                    ...item.metadata,
                    id: item.id,
                    source: item.source
                },
                tokenCount: this.estimateTokenCount(item.content),
                relevanceScore: item.metadata?.relevanceScore || 0
            }));
        } catch (error) {
            this.logger.error('Error retrieving knowledge items:', error);
            return [];
        }
    }

    /**
     * Get conversation history items
     */
    private async getConversationItems(
        source: ContextSourceConfig,
        query: string,
        options: ContextBuildOptions
    ): Promise<ContextItem[]> {
        if (!this.memoryManager || !options.conversationId) return [];

        // Implement conversation history retrieval
        // ...

        return [];
    }

    /**
     * Get goals-related items
     */
    private async getGoalsItems(
        source: ContextSourceConfig,
        query: string,
        options: ContextBuildOptions
    ): Promise<ContextItem[]> {
        if (!this.goalsManager || !options.userId) return [];

        // Implement goals retrieval
        // ...

        return [];
    }

    /**
     * Get user profile items
     */
    private async getUserProfileItems(
        source: ContextSourceConfig,
        query: string,
        options: ContextBuildOptions
    ): Promise<ContextItem[]> {
        if (!this.userProfileManager || !options.userId) return [];

        // Implement user profile retrieval
        // ...

        return [];
    }

    /**
     * Get system instructions
     */
    private async getSystemItems(
        source: ContextSourceConfig,
        query: string,
        options: ContextBuildOptions
    ): Promise<ContextItem[]> {
        // Return basic system instructions
        return [{
            sourceType: ContextSourceType.SYSTEM,
            content: source.params?.instructions ||
                'You are a helpful AI assistant powered by NeuroCore.',
            tokenCount: this.estimateTokenCount(
                source.params?.instructions ||
                'You are a helpful AI assistant powered by NeuroCore.'
            ),
            relevanceScore: 1.0
        }];
    }

    /**
     * Generate a system message based on available context
     */
    private async generateSystemMessage(options: ContextBuildOptions): Promise<string> {
        // Simple system message for now
        return 'You are a helpful AI assistant powered by NeuroCore.';
    }

    /**
     * Estimate token count for a string
     */
    private estimateTokenCount(text: string): number {
        // Rough estimate: 4 chars per token on average
        return Math.ceil(text.length / 4);
    }

    /**
     * Deduplicate similar context items
     */
    private deduplicateItems<T extends ContextItem>(items: T[]): T[] {
        const result: T[] = [];
        const contentHashes = new Set<string>();

        for (const item of items) {
            // Create a simple hash of the content for comparison
            const contentHash = this.simpleHash(item.content);

            if (!contentHashes.has(contentHash)) {
                contentHashes.add(contentHash);
                result.push(item);
            }
        }

        return result;
    }

    /**
     * Create a simple hash for deduplication
     */
    private simpleHash(text: string): string {
        // Simplify the text first (lowercase, remove extra whitespace)
        const simplified = text.toLowerCase().replace(/\s+/g, ' ').trim();

        // For longer texts, just use first 100 chars to avoid excessive computation
        const sample = simplified.length > 100 ? simplified.substring(0, 100) : simplified;

        // Simple string hash
        let hash = 0;
        for (let i = 0; i < sample.length; i++) {
            const char = sample.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }

        return hash.toString(16);
    }
} 