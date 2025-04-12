/**
 * Factory functions for memory system
 */
import { MemoryManager } from './memoryManager';
import { MemoryType } from './types';

// Constants for standard memory tables
export const MEMORY_TABLES = {
    MESSAGES: 'messages',
    SUMMARIES: 'summaries',
    FACTS: 'facts',
    DOCUMENTS: 'documents',
    KNOWLEDGE: 'knowledge',
    REFLECTIONS: 'reflections'
};

/**
 * Create a memory manager with specified settings
 * @param options Configuration options for the memory manager
 * @returns Configured memory manager
 */
export function createMemoryManager(options: {
    tableName: string;
    runtime: any;
    logger?: any;
    embeddingProvider?: any;
}): MemoryManager {
    return new MemoryManager(options);
}

/**
 * Create a set of standard memory managers
 * @param runtime The runtime instance to use
 * @param logger Optional logger instance
 * @param embeddingProvider Optional embedding provider
 * @returns Object containing standard memory managers
 */
export function createStandardMemoryManagers(
    runtime: any,
    logger?: any,
    embeddingProvider?: any
): Record<string, MemoryManager> {
    const baseOptions = {
        runtime,
        logger,
        embeddingProvider
    };

    return {
        // Messages: chat history and conversation memories
        messages: createMemoryManager({
            ...baseOptions,
            tableName: MEMORY_TABLES.MESSAGES
        }),

        // Summaries: conversation summaries, topic summaries, etc.
        summaries: createMemoryManager({
            ...baseOptions,
            tableName: MEMORY_TABLES.SUMMARIES
        }),

        // Facts: extracted facts about users, topics, etc.
        facts: createMemoryManager({
            ...baseOptions,
            tableName: MEMORY_TABLES.FACTS
        }),

        // Documents: longer-form content like articles or documentation
        documents: createMemoryManager({
            ...baseOptions,
            tableName: MEMORY_TABLES.DOCUMENTS
        }),

        // Knowledge: domain knowledge, reference information
        knowledge: createMemoryManager({
            ...baseOptions,
            tableName: MEMORY_TABLES.KNOWLEDGE
        }),

        // Reflections: agent reflections, reasoning, planning
        reflections: createMemoryManager({
            ...baseOptions,
            tableName: MEMORY_TABLES.REFLECTIONS
        })
    };
}

/**
 * Get the appropriate memory manager based on memory type
 * @param managers Record of memory managers
 * @param type Memory type
 * @returns The appropriate memory manager
 */
export function getManagerForType(
    managers: Record<string, MemoryManager>,
    type: MemoryType
): MemoryManager {
    switch (type) {
        case MemoryType.MESSAGE:
            return managers.messages;
        case MemoryType.SUMMARY:
            return managers.summaries;
        case MemoryType.FACT:
            return managers.facts;
        case MemoryType.DOCUMENT:
            return managers.documents;
        case MemoryType.KNOWLEDGE:
            return managers.knowledge;
        case MemoryType.REFLECTION:
            return managers.reflections;
        default:
            return managers.messages; // Default to messages
    }
} 