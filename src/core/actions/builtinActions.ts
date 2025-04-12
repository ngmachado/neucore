/**
 * Built-in actions for the action system
 * 
 * Provides a set of standard actions that can be used directly or as templates.
 */
import { Action, ActionResult } from './types';

/**
 * Action categories
 */
export enum ActionCategory {
    SYSTEM = 'system',
    MEMORY = 'memory',
    KNOWLEDGE = 'knowledge',
    COMMUNICATION = 'communication',
    DATA = 'data',
    TOOLS = 'tools'
}

/**
 * Effect types for actions
 */
export enum ActionEffect {
    READ = 'read',
    WRITE = 'write',
    NETWORK = 'network',
    SYSTEM = 'system',
    MEMORY = 'memory',
    USER_INTERACTION = 'user-interaction'
}

/**
 * Create a memory query action
 * @returns Memory query action definition
 */
export function createMemoryQueryAction(memoryManager: any): Action {
    return {
        definition: {
            id: 'memory:query',
            name: 'Query Memory',
            description: 'Search for relevant memories based on text query or embedding',
            category: ActionCategory.MEMORY,
            parameters: [
                {
                    name: 'query',
                    description: 'Text query to search for',
                    required: true,
                    type: 'string'
                },
                {
                    name: 'limit',
                    description: 'Maximum number of results to return',
                    required: false,
                    defaultValue: 5,
                    type: 'number'
                },
                {
                    name: 'types',
                    description: 'Types of memories to include',
                    required: false,
                    type: 'array',
                    defaultValue: []
                },
                {
                    name: 'threshold',
                    description: 'Similarity threshold (0-1)',
                    required: false,
                    defaultValue: 0.7,
                    type: 'number',
                    validate: (value) => {
                        if (value < 0 || value > 1) {
                            return 'Threshold must be between 0 and 1';
                        }
                        return true;
                    }
                }
            ],
            effects: [ActionEffect.READ, ActionEffect.MEMORY],
            requiredPermissions: ['memory:read'],
            enabled: true,
            visible: true
        },
        execute: async (params, context) => {
            try {
                // Generate embedding for the query
                const embedding = await context.embeddingProvider?.generateEmbedding(params.query);

                // Search memories by embedding
                const memories = await memoryManager.searchMemoriesByEmbedding(embedding, {
                    roomId: context.roomId,
                    agentId: context.agentId,
                    matchThreshold: params.threshold,
                    count: params.limit,
                    type: params.types.length > 0 ? params.types : undefined
                });

                return {
                    success: true,
                    data: {
                        memories,
                        count: memories.length,
                        query: params.query
                    }
                };
            } catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                };
            }
        }
    };
}

/**
 * Create a memory store action
 * @returns Memory storage action definition
 */
export function createMemoryStoreAction(memoryManager: any): Action {
    return {
        definition: {
            id: 'memory:store',
            name: 'Store Memory',
            description: 'Store a new memory item',
            category: ActionCategory.MEMORY,
            parameters: [
                {
                    name: 'content',
                    description: 'Text content of the memory',
                    required: true,
                    type: 'string'
                },
                {
                    name: 'type',
                    description: 'Type of memory',
                    required: false,
                    defaultValue: 'fact',
                    type: 'string',
                    enum: ['message', 'fact', 'summary', 'document', 'knowledge', 'reflection']
                },
                {
                    name: 'metadata',
                    description: 'Additional metadata for the memory',
                    required: false,
                    type: 'object',
                    defaultValue: {}
                },
                {
                    name: 'importance',
                    description: 'Importance score (0-1)',
                    required: false,
                    defaultValue: 0.5,
                    type: 'number',
                    validate: (value) => {
                        if (value < 0 || value > 1) {
                            return 'Importance must be between 0 and 1';
                        }
                        return true;
                    }
                }
            ],
            effects: [ActionEffect.WRITE, ActionEffect.MEMORY],
            requiredPermissions: ['memory:write'],
            enabled: true,
            visible: true
        },
        execute: async (params, context) => {
            try {
                if (!context.roomId || !context.userId) {
                    return {
                        success: false,
                        error: 'Missing required context: roomId and userId'
                    };
                }

                // Create memory object
                const memory = {
                    userId: context.userId,
                    roomId: context.roomId,
                    agentId: context.agentId,
                    content: {
                        text: params.content,
                        role: 'agent'
                    },
                    metadata: {
                        ...params.metadata,
                        importance: params.importance,
                        source: 'action'
                    },
                    type: params.type
                };

                // Store the memory
                const createdMemory = await memoryManager.createMemory(memory);

                return {
                    success: true,
                    data: {
                        memoryId: createdMemory.id,
                        stored: true
                    }
                };
            } catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                };
            }
        }
    };
}

/**
 * Create a RAG knowledge query action
 * @returns Knowledge query action definition
 */
export function createKnowledgeQueryAction(ragManager: any): Action {
    return {
        definition: {
            id: 'knowledge:query',
            name: 'Query Knowledge',
            description: 'Search for relevant knowledge from the RAG system',
            category: ActionCategory.KNOWLEDGE,
            parameters: [
                {
                    name: 'query',
                    description: 'Text query to search for',
                    required: true,
                    type: 'string'
                },
                {
                    name: 'maxResults',
                    description: 'Maximum number of results to return',
                    required: false,
                    defaultValue: 5,
                    type: 'number'
                },
                {
                    name: 'minSimilarity',
                    description: 'Minimum similarity threshold (0-1)',
                    required: false,
                    defaultValue: 0.7,
                    type: 'number',
                    validate: (value) => {
                        if (value < 0 || value > 1) {
                            return 'Similarity threshold must be between 0 and 1';
                        }
                        return true;
                    }
                },
                {
                    name: 'postprocessing',
                    description: 'Post-processing options',
                    required: false,
                    type: 'object',
                    defaultValue: {
                        deduplicate: true,
                        rerank: true,
                        summarize: false
                    }
                }
            ],
            effects: [ActionEffect.READ, ActionEffect.MEMORY],
            requiredPermissions: ['knowledge:read'],
            enabled: true,
            visible: true
        },
        execute: async (params, context) => {
            try {
                // Search knowledge
                const results = await ragManager.searchKnowledge({
                    query: params.query,
                    maxResults: params.maxResults,
                    minSimilarity: params.minSimilarity,
                    agentId: context.agentId,
                    postprocessingOptions: params.postprocessing
                });

                return {
                    success: true,
                    data: {
                        results,
                        count: results.length,
                        query: params.query
                    }
                };
            } catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                };
            }
        }
    };
}

/**
 * Create a system info action
 * @returns System info action definition
 */
export function createSystemInfoAction(): Action {
    return {
        definition: {
            id: 'system:info',
            name: 'System Information',
            description: 'Get information about the system',
            category: ActionCategory.SYSTEM,
            parameters: [],
            effects: [ActionEffect.READ],
            requiredPermissions: ['system:read'],
            enabled: true,
            visible: true
        },
        execute: async (_params, context) => {
            try {
                return {
                    success: true,
                    data: {
                        timestamp: Date.now(),
                        version: '0.1.0',
                        agentId: context.agentId,
                        userId: context.userId,
                        runtime: {
                            platform: process.platform,
                            nodeVersion: process.version,
                            uptime: process.uptime()
                        }
                    }
                };
            } catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                };
            }
        }
    };
} 