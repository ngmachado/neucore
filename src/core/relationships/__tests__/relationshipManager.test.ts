/**
 * Tests for the Relationship Manager
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { RelationshipManager } from '../relationshipManager';
import { RelationshipEntity } from '../../database/interfaces';
import { UUID } from '../../../types';

describe('RelationshipManager', () => {
    let relationshipManager: RelationshipManager;
    let mockDatabaseService: any;

    beforeEach(() => {
        mockDatabaseService = {
            getRelationshipBetween: vi.fn(),
            createRelationship: vi.fn(),
            getRelationships: vi.fn()
        };
        relationshipManager = new RelationshipManager(mockDatabaseService);
    });

    describe('createRelationship', () => {
        it('should create a new relationship when none exists', async () => {
            const entityA = 'entity-a' as UUID;
            const entityB = 'entity-b' as UUID;
            const primaryId = 'primary-id' as UUID;
            const mockRelationship: RelationshipEntity = {
                id: 'test-id' as UUID,
                entityA,
                entityB,
                type: 'test-type',
                status: 'active',
                primaryId,
                metadata: {}
            };

            mockDatabaseService.getRelationshipBetween.mockImplementation(() => Promise.resolve(null));
            mockDatabaseService.createRelationship.mockImplementation(() => Promise.resolve(mockRelationship));

            const result = await relationshipManager.createRelationship(
                entityA,
                entityB,
                'test-type',
                'active',
                primaryId
            );

            expect(result).toEqual(mockRelationship);
            expect(mockDatabaseService.getRelationshipBetween).toHaveBeenCalledWith(entityA, entityB);
            expect(mockDatabaseService.createRelationship).toHaveBeenCalledWith(
                expect.objectContaining({
                    entityA,
                    entityB,
                    type: 'test-type',
                    status: 'active',
                    primaryId,
                    createdAt: expect.any(Date),
                    updatedAt: expect.any(Date),
                    id: expect.any(String)
                })
            );
        });

        it('should return existing relationship when one exists', async () => {
            const entityA = 'entity-a' as UUID;
            const entityB = 'entity-b' as UUID;
            const primaryId = 'primary-id' as UUID;
            const existingRelationship: RelationshipEntity = {
                id: 'existing-id' as UUID,
                entityA,
                entityB,
                type: 'test-type',
                status: 'active',
                primaryId,
                metadata: {}
            };

            mockDatabaseService.getRelationshipBetween.mockImplementation(() => Promise.resolve(existingRelationship));

            const result = await relationshipManager.createRelationship(
                entityA,
                entityB,
                'test-type',
                'active',
                primaryId
            );

            expect(result).toEqual(existingRelationship);
            expect(mockDatabaseService.getRelationshipBetween).toHaveBeenCalledWith(entityA, entityB);
            expect(mockDatabaseService.createRelationship).not.toHaveBeenCalled();
        });
    });

    describe('getRelationships', () => {
        it('should return relationships for an entity', async () => {
            const entityId = 'test-entity' as UUID;
            const relationships: RelationshipEntity[] = [
                {
                    id: 'rel-1' as UUID,
                    entityA: entityId,
                    entityB: 'other-1' as UUID,
                    type: 'test-type',
                    status: 'active',
                    primaryId: 'primary-1' as UUID,
                    metadata: {}
                },
                {
                    id: 'rel-2' as UUID,
                    entityA: 'other-2' as UUID,
                    entityB: entityId,
                    type: 'test-type',
                    status: 'active',
                    primaryId: 'primary-2' as UUID,
                    metadata: {}
                }
            ];

            mockDatabaseService.getRelationships.mockImplementation(() => Promise.resolve(relationships));

            const result = await relationshipManager.getRelationships(entityId);

            expect(result).toEqual(relationships);
            expect(mockDatabaseService.getRelationships).toHaveBeenCalledWith(entityId, undefined);
        });
    });
}); 