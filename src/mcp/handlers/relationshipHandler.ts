/**
 * Relationship Handler
 * 
 * Provides relationship management capabilities through the intent system.
 */

import { Intent } from '../intent';
import { IntentHandler, IntentResult } from '../intentHandler';
import { RelationshipManager } from '../../core/relationships/relationshipManager';
import { RequestContext } from '../interfaces/plugin';
import { UUID } from '../../types';
import { IntentFilter } from '../intentFilter';

/**
 * Handler for relationship-related intents
 */
export class RelationshipHandler implements IntentHandler {
    private relationshipManager: RelationshipManager;

    constructor(relationshipManager: RelationshipManager) {
        this.relationshipManager = relationshipManager;
    }

    /**
     * Get intent filters for this handler
     */
    getIntentFilters(): IntentFilter[] {
        const filters: IntentFilter[] = [];

        // Relationship create filter
        const createFilter = new IntentFilter(10);
        createFilter.addAction('relationship:create');
        filters.push(createFilter);

        // Relationship find filter
        const findFilter = new IntentFilter(10);
        findFilter.addAction('relationship:find');
        filters.push(findFilter);

        return filters;
    }

    /**
     * Handle an intent
     */
    async handleIntent(intent: Intent, context: RequestContext): Promise<IntentResult> {
        try {
            switch (intent.action) {
                case 'relationship:create':
                    return this.handleCreateRelationship(intent, context);
                case 'relationship:get':
                    return this.handleGetRelationship(intent, context);
                case 'relationship:update':
                    return this.handleUpdateRelationship(intent, context);
                case 'relationship:list':
                    return this.handleListRelationships(intent, context);
                default:
                    return {
                        success: false,
                        error: `Unsupported intent: ${intent.action}`
                    };
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Handle relationship creation
     */
    private async handleCreateRelationship(intent: Intent, context: RequestContext): Promise<IntentResult> {
        const { entityA, entityB, type, status, metadata = {} } = intent.data || {};
        const primaryId = context.userId || entityA;
        const contextId = context.roomId;

        if (!entityA || !entityB || !type || !status) {
            return {
                success: false,
                error: 'entityA, entityB, type, and status are required for relationship creation'
            };
        }

        try {
            const relationship = await this.relationshipManager.createRelationship(
                entityA as UUID,
                entityB as UUID,
                type,
                status,
                primaryId as UUID,
                contextId as UUID,
                metadata
            );

            return {
                success: true,
                data: { relationship }
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Handle getting relationship details
     */
    private async handleGetRelationship(intent: Intent, context: RequestContext): Promise<IntentResult> {
        const { entityA, entityB } = intent.data || {};

        if (entityA && entityB) {
            // Get relationship between two entities
            const relationship = await this.relationshipManager.getRelationshipBetween(
                entityA as UUID,
                entityB as UUID
            );

            return {
                success: true,
                data: { relationship }
            };
        } else {
            return {
                success: false,
                error: 'Both entityA and entityB are required to get a relationship'
            };
        }
    }

    /**
     * Handle relationship update
     */
    private async handleUpdateRelationship(intent: Intent, context: RequestContext): Promise<IntentResult> {
        const { relationshipId, status, metadata } = intent.data || {};

        if (!relationshipId) {
            return {
                success: false,
                error: 'relationshipId is required for relationship update'
            };
        }

        try {
            const result = await this.relationshipManager.updateRelationship(
                relationshipId as UUID,
                { status, metadata }
            );

            return {
                success: true,
                data: { relationship: result }
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Handle listing relationships
     */
    private async handleListRelationships(intent: Intent, context: RequestContext): Promise<IntentResult> {
        const { entityId, type, status, limit, offset } = intent.data || {};

        if (!entityId) {
            return {
                success: false,
                error: 'entityId is required to list relationships'
            };
        }

        try {
            const relationships = await this.relationshipManager.getRelationships(
                entityId as UUID,
                { type, status, limit, offset }
            );

            return {
                success: true,
                data: { relationships, count: relationships.length }
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
} 