/**
 * Goal tracking types for the NeuroCore framework
 */

import { UUID } from "../types";

/**
 * Goal status enum
 */
export enum GoalStatus {
    DONE = "DONE",
    FAILED = "FAILED",
    IN_PROGRESS = "IN_PROGRESS",
    PENDING = "PENDING",
    CANCELED = "CANCELED"
}

/**
 * Represents a single objective within a goal
 */
export interface Objective {
    /** Unique identifier */
    id?: UUID;

    /** Description of what needs to be achieved */
    description: string;

    /** Whether objective is completed */
    completed: boolean;

    /** Completion percentage (0-100) */
    progress?: number;

    /** Additional properties for the objective */
    metadata?: Record<string, any>;

    /** Creation timestamp */
    createdAt?: Date;

    /** Last update timestamp */
    updatedAt?: Date;
}

/**
 * Represents a high-level goal composed of objectives
 */
export interface Goal {
    /** Unique identifier */
    id?: UUID;

    /** Room or context ID where goal exists */
    contextId: UUID;

    /** User ID of goal owner */
    userId: UUID;

    /** Agent ID if applicable */
    agentId?: UUID;

    /** Name/title of the goal */
    name: string;

    /** Detailed description */
    description?: string;

    /** Current status */
    status: GoalStatus;

    /** Component objectives */
    objectives: Objective[];

    /** Priority level (higher is more important) */
    priority?: number;

    /** Dependencies on other goals (goal IDs) */
    dependencies?: UUID[];

    /** Due date if applicable */
    dueDate?: Date;

    /** Start date */
    startDate?: Date;

    /** Completion date */
    completedDate?: Date;

    /** Additional properties for the goal */
    metadata?: Record<string, any>;

    /** Creation timestamp */
    createdAt?: Date;

    /** Last update timestamp */
    updatedAt?: Date;
} 