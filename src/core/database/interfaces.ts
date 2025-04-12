/**
 * Database interfaces for the NeuroCore framework
 */

import { UUID } from '../../types';
import { Relationship } from '../../types/framework';
import { Goal } from '../../types/goals';

/**
 * Database query options
 */
export interface QueryOptions {
    limit?: number;
    offset?: number;
    order?: 'asc' | 'desc';
    orderBy?: string;
    roomId?: UUID;
    userId?: UUID;
    agentId?: UUID;
    before?: Date;
    after?: Date;
    [key: string]: any;
}

/**
 * Memory entity interface for database operations
 */
export interface MemoryEntity {
    id: UUID;
    roomId: UUID;
    userId: UUID;
    agentId?: UUID;
    content: any;
    embedding?: number[];
    metadata?: Record<string, any>;
    timestamp: Date;
    type?: string;
}

/**
 * Relationship entity interface for database operations
 */
export interface RelationshipEntity extends Relationship {
    // Base interface already complete, just creating the Entity alias for consistency
}

/**
 * Goal entity interface for database operations
 */
export interface GoalEntity extends Goal {
    // Base interface already complete, just creating the Entity alias for consistency
}

/**
 * Vector search options
 */
export interface VectorSearchOptions extends QueryOptions {
    embedding: number[];
    count?: number;
    similarityThreshold?: number;
}

/**
 * Database adapter interface
 */
export interface DatabaseAdapter {
    /**
     * Connect to the database
     */
    connect(): Promise<void>;

    /**
     * Disconnect from the database
     */
    disconnect(): Promise<void>;

    /**
     * Create a memory record
     * @param memory Memory to create
     * @returns The created memory with ID
     */
    createMemory(memory: MemoryEntity): Promise<MemoryEntity>;

    /**
     * Get a memory by ID
     * @param id Memory ID
     * @returns The memory object
     */
    getMemory(id: UUID): Promise<MemoryEntity | null>;

    /**
     * Update a memory
     * @param id Memory ID
     * @param data Updated memory data
     * @returns The updated memory
     */
    updateMemory(id: UUID, data: Partial<MemoryEntity>): Promise<MemoryEntity>;

    /**
     * Delete a memory
     * @param id Memory ID
     * @returns Success status
     */
    deleteMemory(id: UUID): Promise<boolean>;

    /**
     * Get memories matching the query options
     * @param options Query options
     * @returns Array of memories
     */
    getMemories(options: QueryOptions): Promise<MemoryEntity[]>;

    /**
     * Search memories by vector embedding similarity
     * @param options Vector search options
     * @returns Array of memories with similarity scores
     */
    searchByEmbedding(options: VectorSearchOptions): Promise<Array<MemoryEntity & { similarity: number }>>;

    /**
     * Create a table if it doesn't exist
     * @param tableName Table name
     * @param schema Table schema
     */
    createTableIfNotExists(tableName: string, schema: Record<string, any>): Promise<void>;

    /**
     * Execute a raw query
     * @param query Query string
     * @param params Query parameters
     * @returns Query results
     */
    executeQuery<T = any>(query: string, params?: any[]): Promise<T[]>;

    /**
     * Get database status
     * @returns Status information
     */
    getStatus(): Promise<Record<string, any>>;

    /**
     * Create a relationship between entities
     * @param relationship Relationship to create
     * @returns The created relationship with ID
     */
    createRelationship(relationship: RelationshipEntity): Promise<RelationshipEntity>;

    /**
     * Get a relationship by ID
     * @param id Relationship ID
     * @returns The relationship object
     */
    getRelationship(id: UUID): Promise<RelationshipEntity | null>;

    /**
     * Get a relationship between two entities
     * @param entityA First entity ID
     * @param entityB Second entity ID
     * @returns The relationship object or null if not found
     */
    getRelationshipBetween(entityA: UUID, entityB: UUID): Promise<RelationshipEntity | null>;

    /**
     * Update a relationship
     * @param id Relationship ID
     * @param data Updated relationship data
     * @returns The updated relationship
     */
    updateRelationship(id: UUID, data: Partial<RelationshipEntity>): Promise<RelationshipEntity>;

    /**
     * Delete a relationship
     * @param id Relationship ID
     * @returns Success status
     */
    deleteRelationship(id: UUID): Promise<boolean>;

    /**
     * Get relationships for an entity
     * @param entityId Entity ID
     * @param options Query options
     * @returns Array of relationships
     */
    getRelationships(entityId: UUID, options?: QueryOptions): Promise<RelationshipEntity[]>;

    /**
     * Retrieve goals based on query parameters
     * @param params Search parameters for goals
     * @returns List of matching goals
     */
    getGoals(params: {
        contextId: UUID;
        userId?: UUID;
        agentId?: UUID;
        onlyInProgress?: boolean;
        count?: number;
    }): Promise<GoalEntity[]>;

    /**
     * Get a goal by ID
     * @param id Goal ID
     * @returns The goal or null if not found
     */
    getGoal(id: UUID): Promise<GoalEntity | null>;

    /**
     * Create a new goal
     * @param goal Goal to create
     * @returns The created goal with ID
     */
    createGoal(goal: GoalEntity): Promise<GoalEntity>;

    /**
     * Update an existing goal
     * @param id Goal ID
     * @param data Updated goal data
     * @returns The updated goal
     */
    updateGoal(id: UUID, data: Partial<GoalEntity>): Promise<GoalEntity>;

    /**
     * Delete a goal
     * @param id Goal ID
     * @returns Success status
     */
    deleteGoal(id: UUID): Promise<boolean>;

    /**
     * Delete all goals in a context
     * @param contextId Context ID
     * @returns Success status
     */
    deleteAllGoals(contextId: UUID): Promise<boolean>;
}

/**
 * Relationship database adapter interface
 */
export interface RelationshipDatabaseAdapter {
    /**
     * Create a relationship between entities
     * @param relationship Relationship to create
     * @returns The created relationship with ID
     */
    createRelationship(relationship: RelationshipEntity): Promise<RelationshipEntity>;

    /**
     * Get a relationship by ID
     * @param id Relationship ID
     * @returns The relationship object
     */
    getRelationship(id: UUID): Promise<RelationshipEntity | null>;

    /**
     * Get a relationship between two entities
     * @param entityA First entity ID
     * @param entityB Second entity ID
     * @returns The relationship object or null if not found
     */
    getRelationshipBetween(entityA: UUID, entityB: UUID): Promise<RelationshipEntity | null>;

    /**
     * Update a relationship
     * @param id Relationship ID
     * @param data Updated relationship data
     * @returns The updated relationship
     */
    updateRelationship(id: UUID, data: Partial<RelationshipEntity>): Promise<RelationshipEntity>;

    /**
     * Delete a relationship
     * @param id Relationship ID
     * @returns Success status
     */
    deleteRelationship(id: UUID): Promise<boolean>;

    /**
     * Get relationships for an entity
     * @param entityId Entity ID
     * @param options Query options
     * @returns Array of relationships
     */
    getRelationships(entityId: UUID, options?: QueryOptions): Promise<RelationshipEntity[]>;
} 