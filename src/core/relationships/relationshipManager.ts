/**
 * Relationship Manager implementation
 */

import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database';
import { RelationshipEntity } from '../database/interfaces';
import { Relationship } from '../../types/framework';
import { UUID } from '../../types';
import { getLogger } from '../logging';

const logger = getLogger('RelationshipManager');

/**
 * RelationshipManager class for managing entity relationships
 */
export class RelationshipManager {
    private database: DatabaseService;

    /**
     * Create a new relationship manager
     * @param database Database service instance
     */
    constructor(database: DatabaseService) {
        this.database = database;
        logger.debug('RelationshipManager initialized');
    }

    /**
     * Create a relationship between two entities
     * 
     * @param entityA First entity ID
     * @param entityB Second entity ID 
     * @param type Relationship type
     * @param status Initial relationship status
     * @param primaryId Primary entity ID (owner)
     * @param metadata Additional metadata
     * @returns The created relationship
     */
    async createRelationship(
        entityA: UUID,
        entityB: UUID,
        type: string,
        status: string,
        primaryId: UUID,
        contextId?: UUID,
        metadata?: Record<string, any>
    ): Promise<Relationship> {
        logger.debug(`Creating relationship: ${entityA} -> ${entityB} (${type})`);

        // Check if relationship already exists
        const existing = await this.getRelationshipBetween(entityA, entityB);
        if (existing) {
            logger.debug(`Relationship already exists: ${existing.id}`);
            return existing;
        }

        const now = new Date();
        const relationship: RelationshipEntity = {
            id: uuidv4() as UUID,
            entityA,
            entityB,
            type,
            status,
            primaryId,
            contextId,
            metadata,
            createdAt: now,
            updatedAt: now
        };

        return this.database.createRelationship(relationship);
    }

    /**
     * Get a relationship by ID
     * 
     * @param id Relationship ID
     * @returns The relationship or null if not found
     */
    async getRelationship(id: UUID): Promise<Relationship | null> {
        return this.database.getRelationship(id);
    }

    /**
     * Get a relationship between two entities
     * 
     * @param entityA First entity ID
     * @param entityB Second entity ID
     * @returns The relationship or null if not found
     */
    async getRelationshipBetween(entityA: UUID, entityB: UUID): Promise<Relationship | null> {
        return this.database.getRelationshipBetween(entityA, entityB);
    }

    /**
     * Update a relationship
     * 
     * @param id Relationship ID
     * @param updates Changes to apply
     * @returns The updated relationship
     */
    async updateRelationship(id: UUID, updates: Partial<Relationship>): Promise<Relationship> {
        logger.debug(`Updating relationship: ${id}`);
        const relationship = await this.getRelationship(id);

        if (!relationship) {
            throw new Error(`Relationship not found: ${id}`);
        }

        return this.database.updateRelationship(id, {
            ...updates,
            updatedAt: new Date()
        });
    }

    /**
     * Delete a relationship
     * 
     * @param id Relationship ID
     * @returns Success status
     */
    async deleteRelationship(id: UUID): Promise<boolean> {
        logger.debug(`Deleting relationship: ${id}`);
        return this.database.deleteRelationship(id);
    }

    /**
     * Get all relationships for an entity
     * 
     * @param entityId Entity ID
     * @param options Optional query parameters
     * @returns Array of relationships
     */
    async getRelationships(entityId: UUID, options?: {
        type?: string;
        status?: string;
        limit?: number;
        offset?: number;
    }): Promise<Relationship[]> {
        logger.debug(`Getting relationships for entity: ${entityId}`);
        return this.database.getRelationships(entityId, options);
    }

    /**
     * Format relationships to extract connected entity IDs
     * 
     * @param entityId The reference entity ID
     * @param relationships List of relationships
     * @returns List of connected entity IDs
     */
    formatRelationships(entityId: UUID, relationships: Relationship[]): UUID[] {
        return relationships.map(relationship => {
            const { entityA, entityB } = relationship;
            return entityA === entityId ? entityB : entityA;
        });
    }
} 