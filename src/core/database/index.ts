/**
 * Database module exports
 */

export * from './interfaces';
export * from './adapters/sqlite';

// Export database service in future versions

/**
 * Database service implementation
 */

import { DatabaseAdapter, MemoryEntity, QueryOptions, VectorSearchOptions, RelationshipEntity, GoalEntity } from './interfaces';
import { UUID } from '../../types';
import { getLogger } from '../logging';
import { Relationship } from '../../types/framework';
import { Goal } from '../../types/goals';

const logger = getLogger('database');

/**
 * Database service class
 * Manages database operations through the configured adapter
 */
export class DatabaseService {
    private adapter: DatabaseAdapter;
    private initialized: boolean = false;

    /**
     * Create a new database service
     * @param adapter The database adapter to use
     */
    constructor(adapter: DatabaseAdapter) {
        this.adapter = adapter;
    }

    /**
     * Initialize the database service
     */
    async initialize(): Promise<void> {
        if (this.initialized) {
            logger.warn('Database service already initialized');
            return;
        }

        logger.info('Initializing database service');
        try {
            await this.adapter.connect();
            this.initialized = true;
            logger.info('Database service initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize database service:', error);
            throw error;
        }
    }

    /**
     * Shut down the database service
     */
    async shutdown(): Promise<void> {
        if (!this.initialized) {
            logger.warn('Database service not initialized, nothing to shut down');
            return;
        }

        logger.info('Shutting down database service');
        try {
            await this.adapter.disconnect();
            this.initialized = false;
            logger.info('Database service shut down successfully');
        } catch (error) {
            logger.error('Error shutting down database service:', error);
            throw error;
        }
    }

    /**
     * Create a memory record
     * @param memory Memory to create
     * @returns The created memory with ID
     */
    async createMemory(memory: MemoryEntity): Promise<MemoryEntity> {
        this.checkInitialized();
        logger.debug('Creating memory record');
        return this.adapter.createMemory(memory);
    }

    /**
     * Get a memory by ID
     * @param id Memory ID
     * @returns The memory object
     */
    async getMemory(id: UUID): Promise<MemoryEntity | null> {
        this.checkInitialized();
        logger.debug(`Getting memory with ID: ${id}`);
        return this.adapter.getMemory(id);
    }

    /**
     * Update a memory
     * @param id Memory ID
     * @param data Updated memory data
     * @returns The updated memory
     */
    async updateMemory(id: UUID, data: Partial<MemoryEntity>): Promise<MemoryEntity> {
        this.checkInitialized();
        logger.debug(`Updating memory with ID: ${id}`);
        return this.adapter.updateMemory(id, data);
    }

    /**
     * Delete a memory
     * @param id Memory ID
     * @returns Success status
     */
    async deleteMemory(id: UUID): Promise<boolean> {
        this.checkInitialized();
        logger.debug(`Deleting memory with ID: ${id}`);
        return this.adapter.deleteMemory(id);
    }

    /**
     * Get memories matching the query options
     * @param options Query options
     * @returns Array of memories
     */
    async getMemories(options: QueryOptions): Promise<MemoryEntity[]> {
        this.checkInitialized();
        logger.debug('Querying memories with options:', options);
        return this.adapter.getMemories(options);
    }

    /**
     * Search memories by vector embedding similarity
     * @param options Vector search options
     * @returns Array of memories with similarity scores
     */
    async searchByEmbedding(options: VectorSearchOptions): Promise<Array<MemoryEntity & { similarity: number }>> {
        this.checkInitialized();
        logger.debug('Searching memories by embedding similarity');
        return this.adapter.searchByEmbedding(options);
    }

    /**
     * Execute a raw query
     * @param query Query string
     * @param params Query parameters
     * @returns Query results
     */
    async executeQuery<T = any>(query: string, params?: any[]): Promise<T[]> {
        this.checkInitialized();
        logger.debug('Executing raw query');
        return this.adapter.executeQuery<T>(query, params);
    }

    /**
     * Get database status
     * @returns Status information
     */
    async getStatus(): Promise<Record<string, any>> {
        this.checkInitialized();
        return this.adapter.getStatus();
    }

    /**
     * Create a relationship between entities
     * @param relationship Relationship to create
     * @returns The created relationship with ID
     */
    async createRelationship(relationship: RelationshipEntity): Promise<RelationshipEntity> {
        this.checkInitialized();
        logger.debug('Creating relationship record');
        return this.adapter.createRelationship(relationship);
    }

    /**
     * Get a relationship by ID
     * @param id Relationship ID
     * @returns The relationship object
     */
    async getRelationship(id: UUID): Promise<RelationshipEntity | null> {
        this.checkInitialized();
        return this.adapter.getRelationship(id);
    }

    /**
     * Get a relationship between two entities
     * @param entityA First entity ID
     * @param entityB Second entity ID
     * @returns The relationship object or null if not found
     */
    async getRelationshipBetween(entityA: UUID, entityB: UUID): Promise<RelationshipEntity | null> {
        this.checkInitialized();
        return this.adapter.getRelationshipBetween(entityA, entityB);
    }

    /**
     * Update a relationship
     * @param id Relationship ID
     * @param data Updated relationship data
     * @returns The updated relationship
     */
    async updateRelationship(id: UUID, data: Partial<RelationshipEntity>): Promise<RelationshipEntity> {
        this.checkInitialized();
        logger.debug(`Updating relationship: ${id}`);
        return this.adapter.updateRelationship(id, data);
    }

    /**
     * Delete a relationship
     * @param id Relationship ID
     * @returns Success status
     */
    async deleteRelationship(id: UUID): Promise<boolean> {
        this.checkInitialized();
        logger.debug(`Deleting relationship: ${id}`);
        return this.adapter.deleteRelationship(id);
    }

    /**
     * Get relationships for an entity
     * @param entityId Entity ID
     * @param options Query options
     * @returns Array of relationships
     */
    async getRelationships(entityId: UUID, options?: QueryOptions): Promise<RelationshipEntity[]> {
        this.checkInitialized();
        return this.adapter.getRelationships(entityId, options);
    }

    /**
     * Retrieve goals based on query parameters
     * @param params Search parameters for goals
     * @returns List of matching goals
     */
    async getGoals(params: {
        contextId: UUID;
        userId?: UUID;
        agentId?: UUID;
        onlyInProgress?: boolean;
        count?: number;
    }): Promise<GoalEntity[]> {
        this.checkInitialized();
        return this.adapter.getGoals(params);
    }

    /**
     * Get a goal by ID
     * @param id Goal ID
     * @returns The goal or null if not found
     */
    async getGoal(id: UUID): Promise<GoalEntity | null> {
        this.checkInitialized();
        return this.adapter.getGoal(id);
    }

    /**
     * Create a new goal
     * @param goal Goal to create
     * @returns The created goal with ID
     */
    async createGoal(goal: GoalEntity): Promise<GoalEntity> {
        this.checkInitialized();
        logger.debug(`Creating goal: ${goal.name}`);
        return this.adapter.createGoal(goal);
    }

    /**
     * Update an existing goal
     * @param id Goal ID
     * @param data Updated goal data
     * @returns The updated goal
     */
    async updateGoal(id: UUID, data: Partial<GoalEntity>): Promise<GoalEntity> {
        this.checkInitialized();
        logger.debug(`Updating goal: ${id}`);
        return this.adapter.updateGoal(id, data);
    }

    /**
     * Delete a goal
     * @param id Goal ID
     * @returns Success status
     */
    async deleteGoal(id: UUID): Promise<boolean> {
        this.checkInitialized();
        logger.debug(`Deleting goal: ${id}`);
        return this.adapter.deleteGoal(id);
    }

    /**
     * Delete all goals in a context
     * @param contextId Context ID
     * @returns Success status
     */
    async deleteAllGoals(contextId: UUID): Promise<boolean> {
        this.checkInitialized();
        logger.debug(`Deleting all goals in context: ${contextId}`);
        return this.adapter.deleteAllGoals(contextId);
    }

    /**
     * Check if the database service is initialized
     * @throws Error if not initialized
     */
    private checkInitialized(): void {
        if (!this.initialized) {
            throw new Error('Database service not initialized. Call initialize() first.');
        }
    }
} 