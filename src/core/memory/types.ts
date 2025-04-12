/**
 * Memory system types
 */
import { UUID } from '../../types';

/**
 * Memory content structure
 */
export interface MemoryContent {
    text?: string;
    role?: string;
    timestamp?: Date;
    [key: string]: any;
}

/**
 * Basic memory structure
 */
export interface Memory {
    id?: UUID;
    agentId?: UUID;
    userId: UUID;
    roomId: UUID;
    content: MemoryContent;
    embedding?: number[];
    metadata?: {
        importance?: number;
        category?: string;
        tags?: string[];
        source?: string;
        expiresAt?: Date;
        isPrivate?: boolean;
        [key: string]: any;
    };
    createdAt?: Date;
    updatedAt?: Date;
    type?: MemoryType;
}

/**
 * Type of memory for categorization
 */
export enum MemoryType {
    MESSAGE = 'message',
    SUMMARY = 'summary',
    FACT = 'fact',
    DOCUMENT = 'document',
    KNOWLEDGE = 'knowledge',
    REFLECTION = 'reflection'
}

/**
 * Options for retrieving memories
 */
export interface GetMemoriesOptions {
    roomId: UUID;
    agentId?: UUID;
    count?: number;
    unique?: boolean;
    start?: number;
    end?: number;
    type?: MemoryType;
    order?: 'asc' | 'desc';
    orderBy?: 'createdAt' | 'updatedAt' | 'importance';
    filter?: {
        [key: string]: any;
    };
}

/**
 * Options for searching memories by embedding
 */
export interface SearchMemoriesOptions {
    embedding: number[];
    roomId: UUID;
    agentId?: UUID;
    matchThreshold?: number;
    count?: number;
    unique?: boolean;
    type?: MemoryType;
}

/**
 * Memory manager interface
 */
export interface IMemoryManager {
    tableName: string;

    /**
     * Add an embedding to a memory
     */
    addEmbeddingToMemory(memory: Memory): Promise<Memory>;

    /**
     * Get memories by various filters
     */
    getMemories(options: GetMemoriesOptions): Promise<Memory[]>;

    /**
     * Search memories by embedding similarity
     */
    searchMemoriesByEmbedding(embedding: number[], options: SearchMemoriesOptions): Promise<Memory[]>;

    /**
     * Create a new memory
     */
    createMemory(memory: Memory, unique?: boolean): Promise<void>;

    /**
     * Get memory by ID
     */
    getMemoryById(id: UUID): Promise<Memory | null>;

    /**
     * Remove a memory
     */
    removeMemory(id: UUID): Promise<void>;

    /**
     * Remove all memories for a room
     */
    removeAllMemories(roomId: UUID): Promise<void>;

    /**
     * Count memories in a room
     */
    countMemories(roomId: UUID, unique?: boolean): Promise<number>;

    /**
     * Get memory by room IDs
     */
    getMemoriesByRoomIds(params: { roomIds: UUID[], limit?: number }): Promise<Memory[]>;

    /**
     * Get cached embeddings for text
     */
    getCachedEmbeddings(content: string): Promise<Array<{
        embedding: number[];
        levenshtein_score: number;
    }>>;
} 