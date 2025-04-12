/**
 * Factory functions for creating RAG knowledge managers
 */
import { RAGConfig, KnowledgeScope } from '../../types/rag';
import { RAGKnowledgeManager } from './knowledgeManager';

/**
 * Default configuration for RAG
 */
export const DEFAULT_RAG_CONFIG: RAGConfig = {
    tableName: 'rag_knowledge',
    chunkSize: 1000,
    chunkOverlap: 200,
    defaultMinSimilarity: 0.75,
    defaultMaxResults: 5,
    knowledgeRoot: './knowledge',
    preprocessingOptions: {
        removeMarkdown: true,
        removeCode: true,
        removeUrls: true,
        normalizeCasing: true,
        removeExtraWhitespace: true,
        removeStopWords: false,
    },
    postprocessingOptions: {
        deduplicate: true,
        maxResults: 5,
        minRelevanceScore: 0.6,
        rerank: true,
        highlightMatches: false,
        summarize: false,
    },
};

/**
 * Create a RAG knowledge manager
 * @param config Configuration options
 * @param db Database adapter
 * @param embeddingProvider Embedding provider
 * @param logger Logger instance
 * @returns Configured RAG knowledge manager
 */
export function createRAGKnowledgeManager(
    config: Partial<RAGConfig> = {},
    db: any,
    embeddingProvider: any,
    logger: any
): RAGKnowledgeManager {
    // Merge provided config with defaults
    const mergedConfig = {
        ...DEFAULT_RAG_CONFIG,
        ...config,
        preprocessingOptions: {
            ...DEFAULT_RAG_CONFIG.preprocessingOptions,
            ...config.preprocessingOptions
        },
        postprocessingOptions: {
            ...DEFAULT_RAG_CONFIG.postprocessingOptions,
            ...config.postprocessingOptions
        }
    };

    return new RAGKnowledgeManager(
        mergedConfig,
        db,
        embeddingProvider,
        logger
    );
}

/**
 * Create a RAG knowledge manager for a specific agent
 * @param agentId Agent ID
 * @param config Configuration options
 * @param db Database adapter
 * @param embeddingProvider Embedding provider
 * @param logger Logger instance
 * @returns Configured RAG knowledge manager for an agent
 */
export function createAgentRAGKnowledgeManager(
    agentId: string,
    config: Partial<RAGConfig> = {},
    db: any,
    embeddingProvider: any,
    logger: any
): RAGKnowledgeManager {
    // Create a folder specific to this agent
    const agentKnowledgeRoot = `./knowledge/agents/${agentId}`;

    return createRAGKnowledgeManager(
        {
            ...config,
            knowledgeRoot: agentKnowledgeRoot,
        },
        db,
        embeddingProvider,
        logger
    );
} 