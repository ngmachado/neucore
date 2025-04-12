/**
 * Memory utility functions
 */
import { v4 as uuidv4 } from 'uuid';
import { Memory, MemoryType } from './types';

/**
 * Create a new memory instance with default values
 * @param options Initial memory data
 * @returns New memory object
 */
export function createMemory(options: {
    userId: string;
    roomId: string;
    agentId?: string;
    text?: string;
    role?: string;
    type?: MemoryType;
    metadata?: Record<string, any>;
    [key: string]: any;
}): Memory {
    const {
        userId,
        roomId,
        agentId,
        text = '',
        role = 'user',
        type = MemoryType.MESSAGE,
        metadata = {}
    } = options;

    return {
        id: uuidv4(),
        userId,
        roomId,
        agentId,
        content: {
            text,
            role,
            timestamp: new Date()
        },
        metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
        type
    };
}

/**
 * Generate a short summary of a memory object for logging or display
 * @param memory The memory to summarize 
 * @returns Short string summary
 */
export function summarizeMemory(memory: Memory): string {
    if (!memory) return 'undefined';

    const text = memory.content.text || '';
    const truncatedText = text.length > 30
        ? `${text.substring(0, 30)}...`
        : text;

    return `[${memory.type}] ${truncatedText} (${memory.id?.substring(0, 8)})`;
}

/**
 * Extract the most relevant information from a set of memories
 * @param memories List of memories to extract information from
 * @param maxLength Maximum length of extracted text
 * @returns Extracted information as text
 */
export function extractInformation(memories: Memory[], maxLength = 1000): string {
    if (!memories || memories.length === 0) return '';

    // Sort by relevance if available, otherwise by recency
    const sorted = [...memories].sort((a, b) => {
        // First by importance if available
        const importanceA = a.metadata?.importance || 0;
        const importanceB = b.metadata?.importance || 0;

        if (importanceA !== importanceB) {
            return importanceB - importanceA; // Higher importance first
        }

        // Then by recency
        const dateA = a.createdAt || new Date(0);
        const dateB = b.createdAt || new Date(0);
        return dateB.getTime() - dateA.getTime(); // More recent first
    });

    // Extract and combine text content
    let result = '';
    for (const memory of sorted) {
        if (!memory.content.text) continue;

        const toAdd = memory.content.text.trim();

        // Check if adding this would exceed max length
        if (result.length + toAdd.length + 2 > maxLength) {
            // If we already have content, truncate
            if (result.length > 0) {
                break;
            }

            // Otherwise, add a truncated version of this item
            result += toAdd.substring(0, maxLength) + '...';
            break;
        }

        // Add the memory text with a separator
        result += (result ? '\n\n' : '') + toAdd;
    }

    return result;
}

/**
 * Group memories by type
 * @param memories List of memories to group
 * @returns Object with memories grouped by type
 */
export function groupMemoriesByType(memories: Memory[]): Record<string, Memory[]> {
    if (!memories || memories.length === 0) return {};

    return memories.reduce((grouped, memory) => {
        const type = memory.type || MemoryType.MESSAGE;
        if (!grouped[type]) {
            grouped[type] = [];
        }
        grouped[type].push(memory);
        return grouped;
    }, {} as Record<string, Memory[]>);
}

/**
 * Filter memories by matching text content
 * @param memories List of memories to filter
 * @param query Text to search for
 * @returns Filtered list of memories
 */
export function filterMemoriesByText(memories: Memory[], query: string): Memory[] {
    if (!memories || memories.length === 0 || !query) return memories;

    const normalizedQuery = query.toLowerCase().trim();

    return memories.filter(memory =>
        memory.content.text &&
        memory.content.text.toLowerCase().includes(normalizedQuery)
    );
} 