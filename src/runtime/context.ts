/**
 * Runtime Context for NeuroCore
 */

import { UUID } from '../types';
import { Memory } from '../core/memory/types';

/**
 * Runtime context configuration
 */
export interface RuntimeContextConfig {
    maxContextSize?: number;
    contextTimeout?: number;
}

/**
 * Runtime context class
 */
export class RuntimeContext {
    private memories: Memory[];
    private config: RuntimeContextConfig;

    constructor(config: RuntimeContextConfig = {}) {
        this.memories = [];
        this.config = {
            maxContextSize: 1000,
            contextTimeout: 30000,
            ...config
        };
    }

    /**
     * Add a memory to the context
     */
    public addMemory(memory: Memory): void {
        this.memories.push(memory);
        if (this.memories.length > this.config.maxContextSize!) {
            this.memories.shift();
        }
    }

    /**
     * Get all memories in the context
     */
    public getMemories(): Memory[] {
        return [...this.memories];
    }

    /**
     * Clear the context
     */
    public clear(): void {
        this.memories = [];
    }

    /**
     * Get the context size
     */
    public getSize(): number {
        return this.memories.length;
    }
} 