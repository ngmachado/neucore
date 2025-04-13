/**
 * Character and traits system types for Neurocore
 */

import { UUID } from './index';

/**
 * Character trait types
 */
export enum TraitType {
    PERSONALITY = 'personality',
    KNOWLEDGE = 'knowledge',
    STYLE = 'style',
    PREFERENCE = 'preference',
    BACKGROUND = 'background'
}

/**
 * Context types for traits application
 */
export enum TraitContext {
    CHAT = 'chat',
    POST = 'post',
    REFLECTION = 'reflection',
    ANALYSIS = 'analysis'
}

/**
 * Individual trait definition
 */
export interface Trait {
    /** Trait ID */
    id: string;
    /** Trait name */
    name: string;
    /** Trait type */
    type: TraitType;
    /** Trait value/description */
    value: string;
    /** Trait intensity (0-1) */
    intensity?: number;
    /** Contexts where this trait applies */
    contexts?: TraitContext[];
    /** Additional metadata */
    metadata?: Record<string, any>;
}

/**
 * Character definition
 */
export interface Character {
    /** Character ID */
    id: UUID;
    /** Character name */
    name: string;
    /** Character bio */
    bio: string[];
    /** Character traits */
    traits: Trait[];
    /** Backstory/lore */
    lore?: string[];
    /** Example interactions */
    examples?: {
        context: TraitContext;
        input: string;
        output: string;
    }[];
    /** Topics of expertise/interest */
    topics?: string[];
    /** Character settings */
    settings?: Record<string, any>;
    /** Creation timestamp */
    createdAt?: Date;
    /** Last update timestamp */
    updatedAt?: Date;
}

/**
 * Character state - mutable aspects of a character during a session
 */
export interface CharacterState {
    /** Character ID */
    characterId: UUID;
    /** Session ID */
    sessionId: UUID;
    /** Current emotional state */
    emotionalState?: string;
    /** Current context awareness */
    contextAwareness?: Record<string, number>;
    /** Active topics */
    activeTopics?: string[];
    /** Recent interactions count */
    interactionCount?: number;
    /** Additional state data */
    stateData?: Record<string, any>;
    /** Last update timestamp */
    updatedAt: Date;
}

/**
 * Options for trait application
 */
export interface TraitApplicationOptions {
    /** The context to apply traits for */
    context: TraitContext;
    /** Types of traits to apply */
    traitTypes?: TraitType[];
    /** Specific traits to prioritize */
    priorityTraits?: string[];
    /** Whether to adapt traits based on recent interactions */
    adaptToDynamics?: boolean;
    /** Additional options */
    [key: string]: any;
}

/**
 * Result of trait application
 */
export interface TraitApplicationResult {
    /** Modified content */
    content: string;
    /** Traits that were applied */
    appliedTraits: Trait[];
    /** Character state after application */
    characterState: CharacterState;
    /** Usage metrics */
    metrics?: {
        processingTime: number;
        tokensGenerated?: number;
        confidenceScore?: number;
    };
} 