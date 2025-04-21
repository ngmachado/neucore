/**
 * Core types for the Neucore framework
 */

/**
 * Type exports for Neucore
 */

// Re-export all framework types
export * from './framework';

// Re-export character types
export * from './character';

// Export RAG types
export * from './rag';

// Export evaluation types
export * from './evaluation';

// Export goal types
export * from './goals';

// Import and re-export Memory type from core
export { Memory, MemoryType } from '../core/memory/types';

/**
 * UUID type
 */
export type UUID = string;

/**
 * Log level enum
 */
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

/**
 * Content type for messages and memories
 */
export interface Content {
    text?: string;
    [key: string]: any;
}

/**
 * Actor representing a user or agent
 */
export interface Actor {
    id: UUID;
    name: string;
    username?: string;
    details?: {
        tagline?: string;
        summary?: string;
        quote?: string;
        [key: string]: any;
    };
    [key: string]: any;
}

/**
 * Runtime configuration
 */
export interface RuntimeConfig {
    databaseAdapter?: string;
    databaseConfig?: Record<string, any>;
    embedding?: {
        provider: string;
        model?: string;
        dimensions?: number;
        [key: string]: any;
    };
    logging?: {
        level: LogLevel;
        format?: string;
        destination?: string;
    };
    mcp?: {
        plugins?: string[];
        providers?: Record<string, any>;
    };
}

/**
 * Vector database configuration
 */
export interface VectorDBConfig {
    dimensions: number;
    similarityMetric?: 'cosine' | 'euclidean' | 'dot';
    indexType?: string;
    [key: string]: any;
}

/**
 * Trait context for character traits application
 */
export enum TraitContext {
    CHAT = 'chat',
    POST = 'post',
    SUMMARY = 'summary',
    ANALYSIS = 'analysis'
} 