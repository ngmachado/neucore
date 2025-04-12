/**
 * Runtime Memory for NeuroCore
 */

import { UUID } from '../types';
import { Memory } from '../core/memory/types';
import { IMemoryManager } from '../core/memory/types';

/**
 * Runtime memory configuration
 */
export interface RuntimeMemoryConfig {
    maxMemories?: number;
    memoryTimeout?: number;
}

/**
 * Runtime memory class
 */
export class RuntimeMemory {
    private memoryManager: IMemoryManager;
    private config: RuntimeMemoryConfig;

    constructor(memoryManager: IMemoryManager, config: RuntimeMemoryConfig = {}) {
        this.memoryManager = memoryManager;
        this.config = {
            maxMemories: 1000,
            memoryTimeout: 30000,
            ...config
        };
    }

    /**
     * Add a memory
     */
    public async addMemory(memory: Memory): Promise<void> {
        await this.memoryManager.createMemory(memory);
    }

    /**
     * Get memories by room ID
     */
    public async getMemoriesByRoom(roomId: UUID): Promise<Memory[]> {
        return this.memoryManager.getMemories({
            roomId,
            count: this.config.maxMemories
        });
    }

    /**
     * Search memories by embedding
     */
    public async searchMemories(embedding: number[], roomId: UUID): Promise<Memory[]> {
        return this.memoryManager.searchMemoriesByEmbedding(embedding, {
            embedding,
            roomId,
            count: this.config.maxMemories
        });
    }

    /**
     * Remove a memory
     */
    public async removeMemory(memoryId: UUID): Promise<void> {
        await this.memoryManager.removeMemory(memoryId);
    }

    /**
     * Clear all memories for a room
     */
    public async clearMemories(roomId: UUID): Promise<void> {
        await this.memoryManager.removeAllMemories(roomId);
    }
} 