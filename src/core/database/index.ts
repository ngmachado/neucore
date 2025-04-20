/**
 * Database module exports
 */

export * from './interfaces';
export * from './adapters/sqlite';

// Export database service in future versions

/**
 * Database service implementation
 */

import { DatabaseAdapter, MemoryEntity, QueryOptions, VectorSearchOptions, Relationship } from './interfaces';
import { UUID } from '../../types';
import { getLogger } from '../logging';
import { Relationship as RelationshipEntity } from '../../types/framework';
import { Goal as GoalEntity, GoalStatus } from '../../types/goals';

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
        try {
            await this.adapter.deleteMemory(id);
            return true;
        } catch (error) {
            logger.error(`Failed to delete memory ${id}:`, error);
            return false;
        }
    }

    /**
     * Get memories matching the query options
     * @param options Query options
     * @returns Array of memories
     */
    async getMemories(options: QueryOptions): Promise<MemoryEntity[]> {
        this.checkInitialized();
        logger.debug('Querying memories with options:', options);
        return this.adapter.listMemories(options);
    }

    /**
     * Search memories by vector embedding similarity
     * @param options Vector search options
     * @returns Array of memories with similarity scores
     */
    async searchByEmbedding(options: VectorSearchOptions): Promise<Array<MemoryEntity & { similarity: number }>> {
        this.checkInitialized();
        logger.debug('Searching memories by embedding similarity');

        // Generate embedding from the query string in options
        const embedding = await this.generateEmbedding(options.query);

        // Pass both embedding and options to adapter
        const results = await this.adapter.searchByEmbedding(embedding, options);

        // Add similarity scores since adapter results don't include them
        return results.map(memory => ({
            ...memory,
            similarity: 0.8 // Default similarity since actual scores aren't available
        }));
    }

    // Helper method to generate embeddings (placeholder implementation)
    private async generateEmbedding(text: string): Promise<number[]> {
        // In a real implementation, this would call your vector service
        // This is just a placeholder that returns a simple vector
        return Array(128).fill(0).map(() => Math.random() - 0.5);
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

        // Map from RelationshipEntity to adapter's Relationship type
        const adapterRelationship = {
            type: relationship.type || 'default',
            content: relationship.primaryId || '',
            sourceId: relationship.entityA,
            targetId: relationship.entityB,
            metadata: relationship.metadata || {}
        };

        // Create relationship and convert back to RelationshipEntity
        const result = await this.adapter.createRelationship(adapterRelationship);
        return {
            id: result.id,
            type: result.type,
            entityA: result.sourceId,
            entityB: result.targetId,
            primaryId: result.content,
            metadata: result.metadata || {},
            status: 'active', // Default status
            createdAt: result.createdAt
        };
    }

    /**
     * Get a relationship by ID
     * @param id Relationship ID
     * @returns The relationship object
     */
    async getRelationship(id: UUID): Promise<RelationshipEntity | null> {
        this.checkInitialized();
        try {
            const result = await this.adapter.getRelationship(id);

            // Convert from adapter Relationship to RelationshipEntity
            return {
                id: result.id,
                type: result.type,
                entityA: result.sourceId,
                entityB: result.targetId,
                primaryId: result.content,
                metadata: result.metadata || {},
                status: 'active', // Default status 
                createdAt: result.createdAt
            };
        } catch (error) {
            logger.error(`Failed to get relationship ${id}:`, error);
            return null;
        }
    }

    /**
     * Get a relationship between two entities
     * @param entityA First entity ID
     * @param entityB Second entity ID
     * @returns The relationship object or null if not found
     */
    async getRelationshipBetween(entityA: UUID, entityB: UUID): Promise<RelationshipEntity | null> {
        this.checkInitialized();

        // Get all relationships for entityA and filter for entityB
        const relationships = await this.adapter.getRelationships(entityA);

        // Convert and filter for relationships with entityB
        const mappedRelationships = relationships.map(r => ({
            id: r.id,
            type: r.type,
            entityA: r.sourceId,
            entityB: r.targetId,
            primaryId: r.content,
            metadata: r.metadata || {},
            status: 'active',
            createdAt: r.createdAt
        }));

        // Find relationship where entityB is either source or target
        return mappedRelationships.find(r =>
            r.entityA === entityB || r.entityB === entityB
        ) || null;
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

        // Map from RelationshipEntity to adapter's Relationship type
        const adapterUpdates: Partial<Relationship> = {};

        if (data.type) adapterUpdates.type = data.type;
        if (data.primaryId !== undefined) adapterUpdates.content = data.primaryId;
        if (data.entityA) adapterUpdates.sourceId = data.entityA;
        if (data.entityB) adapterUpdates.targetId = data.entityB;
        if (data.metadata) adapterUpdates.metadata = data.metadata;

        // Update using adapter
        const result = await this.adapter.updateRelationship(id, adapterUpdates);

        // Convert back to RelationshipEntity
        return {
            id: result.id,
            type: result.type,
            entityA: result.sourceId,
            entityB: result.targetId,
            primaryId: result.content,
            metadata: result.metadata || {},
            status: 'active', // Default status
            createdAt: result.createdAt
        };
    }

    /**
     * Delete a relationship
     * @param id Relationship ID
     * @returns Success status
     */
    async deleteRelationship(id: UUID): Promise<boolean> {
        this.checkInitialized();
        logger.debug(`Deleting relationship: ${id}`);
        try {
            await this.adapter.deleteRelationship(id);
            return true;
        } catch (error) {
            logger.error(`Failed to delete relationship ${id}:`, error);
            return false;
        }
    }

    /**
     * Get relationships for an entity
     * @param entityId Entity ID
     * @param options Query options
     * @returns Array of relationships
     */
    async getRelationships(entityId: UUID, options?: QueryOptions): Promise<RelationshipEntity[]> {
        this.checkInitialized();
        const relationships = await this.adapter.getRelationships(entityId);

        // Map from adapter Relationship to RelationshipEntity
        return relationships.map(rel => ({
            id: rel.id,
            type: rel.type,
            entityA: rel.sourceId,
            entityB: rel.targetId,
            primaryId: rel.content,
            metadata: rel.metadata || {},
            status: 'active', // Default status
            createdAt: rel.createdAt
        }));
    }

    /**
     * Retrieve goals based on query parameters
     * @param params Search parameters for goals
     * @returns List of matching goals
     */
    async getGoals(params: { contextId?: string; userId?: string; onlyInProgress?: boolean; agentId?: string; count?: number }): Promise<GoalEntity[]> {
        this.checkInitialized();

        // Construct query options from the parameters
        const where: Record<string, any> = {};

        if (params.contextId) {
            where.namespaceId = params.contextId;
        }

        if (params.userId) {
            where.userId = params.userId;
        }

        if (params.onlyInProgress) {
            where.status = 'IN_PROGRESS';
        }

        if (params.agentId) {
            where.agentId = params.agentId;
        }

        // Get the goals with the appropriate options
        const goals = await this.adapter.listGoals({
            where,
            limit: params.count
        });

        // Convert adapter goals to framework GoalEntity format
        return goals.map(goal => ({
            ...goal,
            contextId: goal.namespaceId || params.contextId || '', // Ensure contextId is never undefined
            status: goal.status as GoalStatus // Convert string to GoalStatus enum
        }));
    }

    /**
     * Get a goal by ID
     * @param id Goal ID
     * @returns The goal or null if not found
     */
    async getGoal(id: UUID): Promise<GoalEntity | null> {
        this.checkInitialized();
        const goal = await this.adapter.getGoal(id);
        if (!goal) return null;
        return {
            ...goal,
            contextId: goal.namespaceId || '',
            status: goal.status as GoalStatus
        } as GoalEntity;
    }

    /**
     * Create a new goal
     * @param goal Goal to create
     * @returns The created goal with ID
     */
    async createGoal(goal: GoalEntity): Promise<GoalEntity> {
        this.checkInitialized();
        logger.debug(`Creating goal: ${goal.name}`);
        // Map GoalEntity to adapter's Goal
        const adapterGoal = {
            type: 'goal',
            content: JSON.stringify(goal.objectives || []),
            name: goal.name,
            status: goal.status,
            description: goal.description,
            objectives: goal.objectives || [],
            userId: goal.userId,
            namespaceId: goal.contextId,
            metadata: goal.metadata
        };
        const result = await this.adapter.createGoal(adapterGoal);
        // Map back to GoalEntity
        return {
            ...result,
            contextId: result.namespaceId || goal.contextId,
            status: result.status as GoalStatus
        } as GoalEntity;
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
        // Map to adapter's Goal format
        const updates: any = { ...data };
        if (data.contextId) {
            updates.namespaceId = data.contextId;
            delete updates.contextId;
        }
        const result = await this.adapter.updateGoal(id, updates);
        // Map back to GoalEntity
        return {
            ...result,
            contextId: result.namespaceId || '',
            status: result.status as GoalStatus
        } as GoalEntity;
    }

    /**
     * Delete a goal
     * @param id Goal ID
     * @returns Success status
     */
    async deleteGoal(id: UUID): Promise<boolean> {
        this.checkInitialized();
        logger.debug(`Deleting goal: ${id}`);
        try {
            await this.adapter.deleteGoal(id);
            return true;
        } catch (error) {
            logger.error(`Failed to delete goal ${id}:`, error);
            return false;
        }
    }

    /**
     * Delete all goals in a context
     * @param contextId Context ID
     * @returns Success status
     */
    async deleteAllGoals(contextId: UUID): Promise<boolean> {
        this.checkInitialized();
        logger.debug(`Deleting all goals in context: ${contextId}`);
        try {
            await this.adapter.deleteAllGoals();
            return true;
        } catch (error) {
            logger.error(`Failed to delete goals in context ${contextId}:`, error);
            return false;
        }
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