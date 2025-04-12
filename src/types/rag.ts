/**
 * RAG (Retrieval Augmented Generation) related types
 */
import { UUID } from './index';

export { UUID };

/**
 * Knowledge scope types
 */
export enum KnowledgeScope {
    AGENT = 'agent',    // Knowledge specific to an agent
    GLOBAL = 'global',  // Knowledge shared across all agents
    SESSION = 'session' // Knowledge for a specific session/conversation
}

/**
 * Type of knowledge source
 */
export enum KnowledgeSourceType {
    TEXT = 'text',
    MARKDOWN = 'markdown',
    PDF = 'pdf',
    CODE = 'code',
    JSON = 'json',
    YAML = 'yaml',
    CSV = 'csv',
    URL = 'url'
}

/**
 * RAG Knowledge Item structure
 */
export interface RAGKnowledgeItem {
    id?: UUID;
    content: string;
    metadata?: {
        title?: string;
        source?: string;
        sourceType?: KnowledgeSourceType;
        created?: Date;
        updated?: Date;
        tags?: string[];
        author?: string;
        relevanceScore?: number;
        [key: string]: any;
    };
    embedding?: number[];
    agentId?: UUID;
    scope?: KnowledgeScope;
    isShared?: boolean;
    parentId?: UUID;
}

/**
 * RAG preprocessing options
 */
export interface RAGPreprocessingOptions {
    removeMarkdown?: boolean;
    removeCode?: boolean;
    removeUrls?: boolean;
    normalizeCasing?: boolean;
    removeExtraWhitespace?: boolean;
    maxLength?: number;
    removeStopWords?: boolean;
}

/**
 * RAG postprocessing options
 */
export interface RAGPostprocessingOptions {
    deduplicate?: boolean;
    maxResults?: number;
    minRelevanceScore?: number;
    rerank?: boolean;
    highlightMatches?: boolean;
    summarize?: boolean;
}

/**
 * RAG search parameters
 */
export interface RAGSearchParams {
    query: string;
    maxResults?: number;
    minSimilarity?: number;
    includeMetadata?: boolean;
    scope?: KnowledgeScope;
    agentId?: UUID;
    searchType?: 'semantic' | 'keyword' | 'hybrid';
    preprocessingOptions?: RAGPreprocessingOptions;
    postprocessingOptions?: RAGPostprocessingOptions;
}

/**
 * RAG Knowledge Manager interface
 */
export interface IRAGKnowledgeManager {
    createKnowledge(item: RAGKnowledgeItem): Promise<RAGKnowledgeItem>;
    getKnowledge(params: {
        query?: string;
        id?: UUID;
        agentId?: UUID;
        limit?: number;
    }): Promise<RAGKnowledgeItem[]>;
    searchKnowledge(params: RAGSearchParams): Promise<RAGKnowledgeItem[]>;
    removeKnowledge(id: UUID): Promise<void>;
    clearKnowledge(agentId?: UUID, scope?: KnowledgeScope): Promise<void>;
    processFile(file: {
        path: string;
        content: string;
        type: KnowledgeSourceType;
        isShared?: boolean;
    }): Promise<void>;
}

/**
 * Configuration for RAG knowledge manager
 */
export interface RAGConfig {
    tableName?: string;
    embeddingModel?: string;
    chunkSize?: number;
    chunkOverlap?: number;
    defaultMinSimilarity?: number;
    defaultMaxResults?: number;
    stopWords?: string[];
    knowledgeRoot?: string;
    preprocessingOptions?: RAGPreprocessingOptions;
    postprocessingOptions?: RAGPostprocessingOptions;
}

export interface KnowledgeBase {
    id: UUID;
    name: string;
    description?: string;
    metadata?: Record<string, any>;
} 