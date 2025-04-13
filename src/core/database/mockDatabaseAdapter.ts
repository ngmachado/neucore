import { UUID } from '../../types';
import { Memory } from '../memory/types';

/**
 * Mock database adapter for testing
 */
export class MockDatabaseAdapter {
    private memories: Map<string, Memory> = new Map();
    private logger: any;

    constructor(options: { logger?: any } = {}) {
        this.logger = options.logger || console;
    }

    /**
     * Create a memory
     */
    async createMemory(memory: Memory): Promise<void> {
        if (memory.id) {
            this.memories.set(memory.id, { ...memory });
            this.logger.debug(`Created memory ${memory.id} in mock database`);
        } else {
            this.logger.warn('Attempted to create memory without ID');
        }
    }

    /**
     * Get a memory by ID
     */
    async getMemory(id: string): Promise<Memory | null> {
        return this.memories.get(id) || null;
    }

    /**
     * Get a memory by ID (alias for getMemory to match expected interface)
     */
    async getMemoryById(id: string): Promise<Memory | null> {
        return this.getMemory(id);
    }

    /**
     * Get memories matching criteria
     */
    async getMemories(options: any): Promise<Memory[]> {
        const { roomId, agentId, count = 10, type, order = 'desc' } = options;

        // Filter memories
        let filteredMemories = Array.from(this.memories.values());

        if (roomId) {
            filteredMemories = filteredMemories.filter(m => m.roomId === roomId);
        }

        if (agentId) {
            filteredMemories = filteredMemories.filter(m => m.userId === agentId);
        }

        if (type) {
            filteredMemories = filteredMemories.filter(m => m.type === type);
        }

        // Sort memories
        filteredMemories.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return order === 'desc' ? dateB - dateA : dateA - dateB;
        });

        // Limit results
        return filteredMemories.slice(0, count);
    }

    /**
     * Search memories by embedding similarity
     */
    async searchMemories(options: any): Promise<Memory[]> {
        const {
            roomId,
            agentId,
            embedding,
            match_threshold = 0.2,
            match_count = 10,
            type
        } = options;

        // In a real implementation, this would do a vector similarity search
        // For the mock, we'll just return some filtered memories
        let filteredMemories = Array.from(this.memories.values());

        if (roomId) {
            filteredMemories = filteredMemories.filter(m => m.roomId === roomId);
        }

        if (agentId) {
            filteredMemories = filteredMemories.filter(m => m.userId === agentId);
        }

        if (type) {
            filteredMemories = filteredMemories.filter(m => m.type === type);
        }

        // Add a mock relevance score
        const results = filteredMemories.map(memory => ({
            ...memory,
            relevance: Math.random()
        }));

        // Sort by relevance and limit results
        results.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));
        return results.slice(0, match_count);
    }

    /**
     * Remove a memory
     */
    async removeMemory(id: string): Promise<void> {
        this.memories.delete(id);
        this.logger.debug(`Removed memory ${id} from mock database`);
    }

    /**
     * Remove all memories for a room
     */
    async removeAllMemories(roomId: string): Promise<void> {
        const keysToDelete: string[] = [];

        this.memories.forEach((memory, key) => {
            if (memory.roomId === roomId) {
                keysToDelete.push(key);
            }
        });

        keysToDelete.forEach(key => this.memories.delete(key));
        this.logger.debug(`Removed ${keysToDelete.length} memories for room ${roomId} from mock database`);
    }
} 