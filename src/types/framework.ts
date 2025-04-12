import { UUID } from '../types';

/**
 * Relationship between entities
 */
export interface Relationship {
    /** Unique identifier */
    id: UUID;

    /** First entity ID */
    entityA: UUID;

    /** Second entity ID */
    entityB: UUID;

    /** Type of relationship */
    type: string;

    /** Status of the relationship */
    status: string;

    /** Primary entity ID (typically the owner/creator) */
    primaryId: UUID;

    /** Associated context ID (like roomId) */
    contextId?: UUID;

    /** Additional metadata for the relationship */
    metadata?: Record<string, any>;

    /** Creation timestamp */
    createdAt?: Date;

    /** Last update timestamp */
    updatedAt?: Date;
} 