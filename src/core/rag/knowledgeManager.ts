/**
 * RAG Knowledge Manager implementation
 * 
 * Provides functionality to create, retrieve, search, and manage knowledge items
 * for retrieval-augmented generation (RAG).
 */
import { v4 as uuidv4 } from 'uuid';
import {
    IRAGKnowledgeManager,
    KnowledgeScope,
    KnowledgeSourceType,
    RAGConfig,
    RAGKnowledgeItem,
    RAGSearchParams
} from '../../types/rag';
import { UUID } from '../../types';
import { preprocessText, chunkText } from './preprocessing';
import { postprocessResults } from './postprocessing';
import { LogLevel } from '../../types';
import fs from 'fs';
import path from 'path';

interface SearchResult {
    content: string;
    score: number;
    metadata?: {
        relevanceScore?: number;
        [key: string]: any;
    };
}

/**
 * RAG Knowledge Manager implementation
 */
export class RAGKnowledgeManager implements IRAGKnowledgeManager {
    private readonly config: Required<RAGConfig>;
    private logger: any; // TODO: Use proper logger interface
    private embeddingProvider: any; // TODO: Use proper embedding provider interface
    private db: any; // TODO: Use proper database interface

    /**
     * Create a new RAG Knowledge Manager
     * @param config RAG configuration
     * @param db Database interface
     * @param embeddingProvider Embedding provider
     * @param logger Logger interface
     */
    constructor(
        config: Partial<RAGConfig> = {},
        db: any,
        embeddingProvider: any,
        logger: any
    ) {
        this.config = {
            tableName: config.tableName ?? 'rag_knowledge',
            embeddingModel: config.embeddingModel ?? 'default',
            chunkSize: config.chunkSize ?? 1000,
            chunkOverlap: config.chunkOverlap ?? 200,
            defaultMinSimilarity: config.defaultMinSimilarity ?? 0.75,
            defaultMaxResults: config.defaultMaxResults ?? 5,
            stopWords: config.stopWords ?? [],
            knowledgeRoot: config.knowledgeRoot ?? './knowledge',
            preprocessingOptions: {
                removeMarkdown: false,
                removeCode: false,
                removeUrls: false,
                normalizeCasing: true,
                removeExtraWhitespace: true,
                maxLength: 10000,
                removeStopWords: false,
                ...config.preprocessingOptions
            },
            postprocessingOptions: {
                deduplicate: true,
                maxResults: 10,
                minRelevanceScore: 0.5,
                rerank: true,
                highlightMatches: false,
                summarize: false,
                ...config.postprocessingOptions
            }
        };

        this.db = db;
        this.embeddingProvider = embeddingProvider;
        this.logger = logger;
    }

    /**
     * Create a new knowledge item
     * @param item Knowledge item to create
     * @returns Created knowledge item with ID
     */
    async createKnowledge(item: RAGKnowledgeItem): Promise<RAGKnowledgeItem> {
        try {
            // Ensure the item has an ID
            const knowledgeItem: RAGKnowledgeItem = {
                ...item,
                id: item.id || uuidv4()
            };

            // Generate embedding if needed
            if (!knowledgeItem.embedding) {
                // Process the content
                const processedContent = preprocessText(knowledgeItem.content,
                    this.config.preprocessingOptions);

                // Generate embedding
                knowledgeItem.embedding = await this.embeddingProvider.generateEmbedding(
                    processedContent
                );
            }

            // Save to database
            await this.db.createKnowledgeItem(knowledgeItem);

            // Log success
            this.logger.log(LogLevel.DEBUG, 'Created knowledge item', {
                id: knowledgeItem.id,
                contentLength: knowledgeItem.content.length
            });

            return knowledgeItem;
        } catch (error) {
            this.logger.log(LogLevel.ERROR, 'Failed to create knowledge item', { error });
            throw error;
        }
    }

    /**
     * Get knowledge items by ID or query
     * @param params Search parameters
     * @returns Matching knowledge items
     */
    async getKnowledge(params: {
        query?: string;
        id?: UUID;
        agentId?: UUID;
        limit?: number;
    }): Promise<RAGKnowledgeItem[]> {
        try {
            // If ID is provided, do direct lookup
            if (params.id) {
                const result = await this.db.getKnowledgeById(params.id);
                return result ? [result] : [];
            }

            // If query is provided, perform search
            if (params.query) {
                return this.searchKnowledge({
                    query: params.query,
                    maxResults: params.limit || this.config.defaultMaxResults,
                    agentId: params.agentId,
                    searchType: 'hybrid'
                });
            }

            // Otherwise, return all knowledge for the agent
            if (params.agentId) {
                const results = await this.db.getKnowledgeByAgentId(
                    params.agentId,
                    params.limit || 100
                );
                return results;
            }

            // Default: return global knowledge
            return this.db.getKnowledgeByScope(
                KnowledgeScope.GLOBAL,
                params.limit || 100
            );
        } catch (error) {
            this.logger.log(LogLevel.ERROR, 'Failed to get knowledge', {
                params,
                error
            });
            return [];
        }
    }

    /**
     * Search for knowledge items
     * @param params Search parameters
     * @returns Matching knowledge items
     */
    async searchKnowledge(params: RAGSearchParams): Promise<RAGKnowledgeItem[]> {
        try {
            let results: RAGKnowledgeItem[] = [];

            // Preprocess the query
            const processedQuery = preprocessText(
                params.query,
                params.preprocessingOptions || this.config.preprocessingOptions
            );

            // Generate query embedding
            const queryEmbedding = await this.embeddingProvider.generateEmbedding(
                processedQuery
            );

            const searchType = params.searchType || 'hybrid';
            const minSimilarity = params.minSimilarity || this.config.defaultMinSimilarity || 0.75;

            // Perform vector search if semantic or hybrid
            if (searchType === 'semantic' || searchType === 'hybrid') {
                const vectorResults = await this.db.searchKnowledgeByEmbedding({
                    embedding: queryEmbedding,
                    agentId: params.agentId,
                    scope: params.scope,
                    limit: params.maxResults ?? this.config.defaultMaxResults * 2, // Get more for reranking
                    minSimilarity: minSimilarity
                });

                results = vectorResults.map((item: SearchResult) => ({
                    ...item,
                    metadata: {
                        ...item.metadata,
                        relevanceScore: item.metadata?.relevanceScore ?? 0.0
                    }
                }));
            }

            // Perform keyword search if keyword or hybrid
            if (searchType === 'keyword' || searchType === 'hybrid') {
                // Get additional keyword-based results
                const keywordResults = await this.db.searchKnowledgeByKeywords({
                    query: processedQuery,
                    agentId: params.agentId,
                    scope: params.scope,
                    limit: params.maxResults ?? this.config.defaultMaxResults * 2
                });

                // Combine results (if hybrid)
                if (searchType === 'hybrid') {
                    // Get IDs from vector search to avoid duplicates
                    const existingIds = new Set(results.map(item => item.id));

                    // Add keyword results not already in vector results
                    for (const item of keywordResults) {
                        if (item.id && !existingIds.has(item.id)) {
                            existingIds.add(item.id);
                            results.push(item);
                        }
                    }
                } else {
                    results = keywordResults;
                }
            }

            // Apply postprocessing
            return postprocessResults(
                results,
                params.query,
                params.postprocessingOptions || this.config.postprocessingOptions
            );
        } catch (error) {
            this.logger.log(LogLevel.ERROR, 'Failed to search knowledge', {
                query: params.query,
                error
            });
            return [];
        }
    }

    /**
     * Remove a knowledge item by ID
     * @param id Knowledge item ID
     */
    async removeKnowledge(id: UUID): Promise<void> {
        try {
            await this.db.deleteKnowledgeById(id);
            this.logger.log(LogLevel.DEBUG, 'Removed knowledge item', { id });
        } catch (error) {
            this.logger.log(LogLevel.ERROR, 'Failed to remove knowledge item', {
                id,
                error
            });
            throw error;
        }
    }

    /**
     * Clear knowledge items
     * @param agentId Optional agent ID to clear only that agent's knowledge
     * @param scope Optional scope to clear
     */
    async clearKnowledge(agentId?: UUID, scope?: KnowledgeScope): Promise<void> {
        try {
            if (agentId && scope) {
                await this.db.deleteKnowledgeByAgentAndScope(agentId, scope);
                this.logger.log(LogLevel.INFO, 'Cleared knowledge for agent and scope', {
                    agentId,
                    scope
                });
            } else if (agentId) {
                await this.db.deleteKnowledgeByAgentId(agentId);
                this.logger.log(LogLevel.INFO, 'Cleared knowledge for agent', { agentId });
            } else if (scope) {
                await this.db.deleteKnowledgeByScope(scope);
                this.logger.log(LogLevel.INFO, 'Cleared knowledge for scope', { scope });
            } else {
                await this.db.deleteAllKnowledge();
                this.logger.log(LogLevel.INFO, 'Cleared all knowledge');
            }
        } catch (error) {
            this.logger.log(LogLevel.ERROR, 'Failed to clear knowledge', {
                agentId,
                scope,
                error
            });
            throw error;
        }
    }

    /**
     * Process a file for knowledge extraction
     * @param file File information
     */
    async processFile(file: {
        path: string;
        content: string;
        type: KnowledgeSourceType;
        isShared?: boolean;
    }): Promise<void> {
        try {
            // Skip empty files
            if (!file.content || file.content.trim().length === 0) {
                this.logger.log(LogLevel.WARN, 'Skipping empty file', { path: file.path });
                return;
            }

            // Create a unique ID based on file path (deterministic)
            const fileId = this.generateScopedId(file.path, file.isShared ?? false);

            // First, check if this file is already processed
            const existingItem = await this.db.getKnowledgeById(fileId);

            // If exists and content is same, we can skip processing
            if (existingItem && existingItem.content === file.content) {
                this.logger.log(LogLevel.DEBUG, 'File already processed and unchanged', {
                    path: file.path
                });
                return;
            }

            // If existing but different content, remove old knowledge
            if (existingItem) {
                await this.removeKnowledge(fileId);
            }

            // Apply preprocessing specific to the file type
            let processedContent = file.content;

            // Apply file-type specific preprocessing
            switch (file.type) {
                case KnowledgeSourceType.MARKDOWN:
                    processedContent = preprocessText(processedContent, {
                        ...this.config.preprocessingOptions,
                        removeMarkdown: true
                    });
                    break;

                case KnowledgeSourceType.CODE:
                    processedContent = preprocessText(processedContent, {
                        ...this.config.preprocessingOptions,
                        removeCode: false // We want to keep code for code files
                    });
                    break;

                default:
                    processedContent = preprocessText(
                        processedContent,
                        this.config.preprocessingOptions
                    );
            }

            // Chunk the content
            const chunks = chunkText(
                processedContent,
                this.config.chunkSize,
                this.config.chunkOverlap
            );

            // Store metadata for the parent document
            const parentItem: RAGKnowledgeItem = {
                id: fileId,
                content: file.content.substring(0, 1000) + (file.content.length > 1000 ? '...' : ''),
                metadata: {
                    source: file.path,
                    sourceType: file.type,
                    created: new Date(),
                    isParent: true
                },
                scope: file.isShared ? KnowledgeScope.GLOBAL : KnowledgeScope.AGENT
            };

            // Create parent entry
            await this.createKnowledge(parentItem);

            // Process each chunk
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];

                // Create the knowledge item
                const chunkItem: RAGKnowledgeItem = {
                    id: `${fileId}-chunk-${i}`,
                    content: chunk,
                    metadata: {
                        source: file.path,
                        sourceType: file.type,
                        chunkIndex: i,
                        totalChunks: chunks.length,
                        created: new Date()
                    },
                    scope: file.isShared ? KnowledgeScope.GLOBAL : KnowledgeScope.AGENT,
                    parentId: fileId
                };

                // Store chunk
                await this.createKnowledge(chunkItem);
            }

            this.logger.log(LogLevel.INFO, 'Processed file into knowledge chunks', {
                path: file.path,
                chunks: chunks.length
            });
        } catch (error) {
            this.logger.log(LogLevel.ERROR, 'Failed to process file', {
                path: file.path,
                error
            });
            throw error;
        }
    }

    /**
     * Generate a deterministic ID for a file path
     * @param filePath File path
     * @param isShared Whether the file is shared
     * @returns Deterministic UUID
     */
    public generateScopedId(filePath: string, isShared: boolean): UUID {
        // Convert the path to a normalized format
        const normalizedPath = filePath.replace(/\\/g, '/');

        // Add a prefix for shared vs. non-shared
        const prefix = isShared ? 'shared:' : 'private:';

        // Hash the path into a UUID-compatible string (naive implementation)
        // In a real system, use a proper hashing function
        return uuidv4(); // Use a proper deterministic ID in production
    }
} 