/**
 * Memory manager implementation
 */
import { v4 as uuidv4 } from 'uuid';
import { LogLevel, UUID } from '../../types';
import {
    GetMemoriesOptions,
    IMemoryManager,
    Memory,
    SearchMemoriesOptions
} from './types';
import { MemoryType } from '../../types/memory';

// Default constants
const DEFAULT_MATCH_THRESHOLD = 0.2;
const DEFAULT_MATCH_COUNT = 10;

/**
 * Enhanced memory manager for storing and retrieving memories
 */
export class MemoryManager implements IMemoryManager {
    tableName: string;
    private runtime: any; // To be replaced with proper runtime interface
    private logger: any;  // To be replaced with proper logger interface
    private embeddingProvider: any; // To be replaced with proper embedding provider interface

    /**
     * Create a new memory manager
     * @param options Configuration options
     */
    constructor(options: {
        tableName: string;
        runtime: any;
        logger?: any;
        embeddingProvider?: any;
    }) {
        this.tableName = options.tableName;
        this.runtime = options.runtime;
        this.logger = options.logger || this.runtime?.logger || console;
        this.embeddingProvider = options.embeddingProvider || this.runtime?.embeddingProvider;
    }

    /**
     * Add an embedding to a memory if it doesn't already have one
     * @param memory The memory object
     * @returns Memory with embedding added
     */
    async addEmbeddingToMemory(memory: Memory): Promise<Memory> {
        // Return early if embedding already exists
        if (memory.embedding) {
            return memory;
        }

        const memoryText = memory.content.text;

        // Validate memory has text content
        if (!memoryText) {
            const errorMsg = "Cannot generate embedding: Memory content is empty";
            this.logger.log(LogLevel.ERROR, errorMsg);
            throw new Error(errorMsg);
        }

        try {
            // Generate embedding from text content
            memory.embedding = await this.embeddingProvider.generateEmbedding(memoryText);
            this.logger.log(LogLevel.DEBUG, 'Generated embedding for memory', {
                memoryId: memory.id,
                contentLength: memoryText.length,
                embeddingLength: memory.embedding?.length ?? 0
            });
        } catch (error) {
            this.logger.log(LogLevel.ERROR, 'Failed to generate embedding', { error });
            throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : String(error)}`);
        }

        return memory;
    }

    /**
     * Get memories with various filter options
     * @param options Query options
     * @returns List of memories matching criteria
     */
    async getMemories(options: GetMemoriesOptions): Promise<Memory[]> {
        const {
            roomId,
            agentId = this.runtime?.agentId,
            count = 10,
            unique = true,
            start,
            end,
            type,
            order = 'desc',
            orderBy = 'createdAt'
        } = options;

        this.logger.log(LogLevel.DEBUG, 'Getting memories', {
            tableName: this.tableName,
            roomId,
            agentId,
            count,
            type
        });

        try {
            // Build query options
            const queryOptions = {
                tableName: this.tableName,
                roomId,
                agentId,
                count,
                unique,
                start,
                end,
                type,
                order,
                orderBy
            };

            // Add filter if specified
            if (options.filter) {
                (queryOptions as any).filter = options.filter;
            }

            return this.runtime.databaseAdapter.getMemories(queryOptions);
        } catch (error) {
            this.logger.log(LogLevel.ERROR, 'Failed to get memories', { error });
            return [];
        }
    }

    /**
     * Search for memories by embedding similarity
     * @param embedding The query embedding vector
     * @param options Search options
     * @returns Memories matching the query embedding
     */
    async searchMemoriesByEmbedding(
        embedding: number[],
        options: SearchMemoriesOptions
    ): Promise<Memory[]> {
        const {
            roomId,
            agentId = this.runtime?.agentId,
            matchThreshold = DEFAULT_MATCH_THRESHOLD,
            count = DEFAULT_MATCH_COUNT,
            unique = true,
            type
        } = options;

        this.logger.log(LogLevel.DEBUG, 'Searching memories by embedding', {
            tableName: this.tableName,
            roomId,
            matchThreshold,
            count
        });

        try {
            const searchOptions = {
                tableName: this.tableName,
                roomId,
                agentId,
                embedding,
                match_threshold: matchThreshold,
                match_count: count,
                unique,
                type
            };

            return this.runtime.databaseAdapter.searchMemories(searchOptions);
        } catch (error) {
            this.logger.log(LogLevel.ERROR, 'Failed to search memories by embedding', { error });
            return [];
        }
    }

    /**
     * Create a new memory in the database
     * @param memory Memory object to create
     * @param unique Whether to check for uniqueness before creation
     */
    async createMemory(memory: Memory, unique = false): Promise<void> {
        // Generate ID if not provided
        if (!memory.id) {
            memory.id = uuidv4();
        }

        // Set timestamps
        if (!memory.createdAt) {
            memory.createdAt = new Date();
        }
        memory.updatedAt = new Date();

        // Check if memory already exists to avoid duplicates
        if (memory.id) {
            const existingMemory = await this.getMemoryById(memory.id);
            if (existingMemory) {
                this.logger.log(LogLevel.DEBUG, 'Memory already exists, skipping creation', {
                    id: memory.id
                });
                return;
            }
        }

        // Add embedding if memory has text content and no embedding
        if (memory.content.text && !memory.embedding) {
            try {
                memory = await this.addEmbeddingToMemory(memory);
            } catch (error) {
                this.logger.log(LogLevel.WARN, 'Failed to add embedding to memory, continuing without it', {
                    error,
                    memoryId: memory.id
                });
            }
        }

        this.logger.log(LogLevel.DEBUG, 'Creating new memory', {
            id: memory.id,
            type: memory.type,
            contentLength: memory.content.text?.length || 0
        });

        try {
            await this.runtime.databaseAdapter.createMemory(
                memory,
                this.tableName,
                unique
            );
        } catch (error) {
            this.logger.log(LogLevel.ERROR, 'Failed to create memory', { error, memory });
            throw error;
        }
    }

    /**
     * Get a memory by ID
     * @param id Memory ID
     * @returns Memory object or null if not found
     */
    async getMemoryById(id: UUID): Promise<Memory | null> {
        try {
            return await this.runtime.databaseAdapter.getMemoryById(id, this.tableName);
        } catch (error) {
            this.logger.log(LogLevel.ERROR, 'Failed to get memory by ID', { id, error });
            return null;
        }
    }

    /**
     * Remove a memory from the database
     * @param id Memory ID to remove
     */
    async removeMemory(id: UUID): Promise<void> {
        try {
            await this.runtime.databaseAdapter.removeMemory(id, this.tableName);
            this.logger.log(LogLevel.DEBUG, 'Removed memory', { id });
        } catch (error) {
            this.logger.log(LogLevel.ERROR, 'Failed to remove memory', { id, error });
            throw error;
        }
    }

    /**
     * Remove all memories for a room
     * @param roomId Room ID to clear memories for
     */
    async removeAllMemories(roomId: UUID): Promise<void> {
        try {
            await this.runtime.databaseAdapter.removeAllMemories(
                roomId,
                this.tableName,
                this.runtime?.agentId
            );
            this.logger.log(LogLevel.INFO, 'Removed all memories for room', { roomId });
        } catch (error) {
            this.logger.log(LogLevel.ERROR, 'Failed to remove all memories', { roomId, error });
            throw error;
        }
    }

    /**
     * Count memories in a room
     * @param roomId Room ID to count memories for
     * @param unique Whether to count unique messages only
     * @returns Count of memories
     */
    async countMemories(roomId: UUID, unique = true): Promise<number> {
        try {
            return await this.runtime.databaseAdapter.countMemories({
                tableName: this.tableName,
                roomId,
                agentId: this.runtime?.agentId,
                unique
            });
        } catch (error) {
            this.logger.log(LogLevel.ERROR, 'Failed to count memories', { roomId, error });
            return 0;
        }
    }

    /**
     * Get memories by room IDs
     * @param params Parameters including room IDs and limit
     * @returns List of memories across the specified rooms
     */
    async getMemoriesByRoomIds(params: { roomIds: UUID[], limit?: number }): Promise<Memory[]> {
        try {
            return await this.runtime.databaseAdapter.getMemoriesByRoomIds({
                tableName: this.tableName,
                agentId: this.runtime?.agentId,
                roomIds: params.roomIds,
                limit: params.limit || 100
            });
        } catch (error) {
            this.logger.log(LogLevel.ERROR, 'Failed to get memories by room IDs', {
                roomIds: params.roomIds,
                error
            });
            return [];
        }
    }

    /**
     * Get cached embeddings for similar text
     * @param content Text content to find similar embeddings for
     * @returns Cached embeddings with similarity scores
     */
    async getCachedEmbeddings(content: string): Promise<Array<{
        embedding: number[];
        levenshtein_score: number;
    }>> {
        try {
            return await this.runtime.databaseAdapter.getCachedEmbeddings({
                query_table_name: this.tableName,
                query_threshold: 2,
                query_input: content,
                query_field_name: 'content',
                query_field_sub_name: 'text',
                query_match_count: 10
            });
        } catch (error) {
            this.logger.log(LogLevel.ERROR, 'Failed to get cached embeddings', { error });
            return [];
        }
    }
}

interface QueryOptions {
    tableName: string;
    roomId: string;
    agentId: any;
    count: number;
    unique: boolean;
    start: number | undefined;
    end: number | undefined;
    type: MemoryType | undefined;
    order: "asc" | "desc";
    orderBy: "importance" | "createdAt" | "updatedAt";
    filter?: Record<string, any>;
} 