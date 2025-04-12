/**
 * Goal Manager implementation for tracking goal-oriented interactions
 */

import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database';
import { GoalEntity } from '../database/interfaces';
import { Goal, GoalStatus, Objective } from '../../types/goals';
import { UUID } from '../../types';
import { getLogger } from '../logging';
import { calculateGoalProgress, updateGoalStatus } from './goalUtils';

const logger = getLogger('GoalManager');

/**
 * Goal update options
 */
export interface GoalUpdateOptions {
    /** Updates to the goal's metadata */
    metadata?: Record<string, any>;

    /** Status override */
    status?: GoalStatus;

    /** Description update */
    description?: string;

    /** New objectives to add */
    newObjectives?: Omit<Objective, 'id'>[];

    /** Updated objectives (need to include id) */
    updatedObjectives?: Objective[];

    /** IDs of objectives to remove */
    removeObjectiveIds?: UUID[];

    /** Due date update */
    dueDate?: Date | null;

    /** Auto-update status based on objectives */
    autoUpdateStatus?: boolean;
}

/**
 * Goal Manager for tracking and managing goal-oriented interactions
 */
export class GoalManager {
    private database: DatabaseService;

    /**
     * Create a new goal manager
     * @param database Database service
     */
    constructor(database: DatabaseService) {
        this.database = database;
        logger.debug('GoalManager initialized');
    }

    /**
     * Create a new goal
     * 
     * @param contextId Context ID (e.g. roomId)
     * @param userId User ID who owns the goal
     * @param name Goal name/title
     * @param options Additional goal options
     * @returns The created goal
     */
    async createGoal(
        contextId: UUID,
        userId: UUID,
        name: string,
        options: {
            description?: string;
            objectives?: Array<{ description: string; completed?: boolean }>;
            status?: GoalStatus;
            priority?: number;
            dueDate?: Date;
            agentId?: UUID;
            metadata?: Record<string, any>;
        } = {}
    ): Promise<Goal> {
        logger.debug(`Creating goal: ${name} for user ${userId} in context ${contextId}`);

        const now = new Date();
        const status = options.status || GoalStatus.IN_PROGRESS;

        // Format objectives
        const objectives = (options.objectives || []).map(obj => ({
            id: uuidv4() as UUID,
            description: obj.description,
            completed: obj.completed || false,
            createdAt: now,
            updatedAt: now
        }));

        const goal: GoalEntity = {
            id: uuidv4() as UUID,
            contextId,
            userId,
            name,
            description: options.description,
            objectives,
            status,
            priority: options.priority || 1,
            agentId: options.agentId,
            dueDate: options.dueDate,
            startDate: now,
            metadata: options.metadata || {},
            createdAt: now,
            updatedAt: now
        };

        return await this.database.createGoal(goal);
    }

    /**
     * Get a goal by ID
     * 
     * @param id Goal ID
     * @returns The goal or null if not found
     */
    async getGoal(id: UUID): Promise<Goal | null> {
        return this.database.getGoal(id);
    }

    /**
     * Get all goals for a context
     * 
     * @param contextId Context ID
     * @param options Query options
     * @returns List of matching goals
     */
    async getGoals(
        contextId: UUID,
        options: {
            userId?: UUID;
            agentId?: UUID;
            onlyInProgress?: boolean;
            count?: number;
        } = {}
    ): Promise<Goal[]> {
        return this.database.getGoals({
            contextId,
            userId: options.userId,
            agentId: options.agentId,
            onlyInProgress: options.onlyInProgress,
            count: options.count
        });
    }

    /**
     * Update a goal
     * 
     * @param id Goal ID
     * @param updates Changes to apply
     * @returns The updated goal
     */
    async updateGoal(id: UUID, updates: GoalUpdateOptions): Promise<Goal> {
        logger.debug(`Updating goal: ${id}`);

        // Get the existing goal
        const goal = await this.getGoal(id);
        if (!goal) {
            throw new Error(`Goal not found: ${id}`);
        }

        // Create new objectives if specified
        const newObjectives = updates.newObjectives ? updates.newObjectives.map(obj => ({
            ...obj,
            id: uuidv4() as UUID,
            createdAt: new Date(),
            updatedAt: new Date()
        })) : [];

        // Update existing objectives
        const updatedObjectiveMap = new Map();
        if (updates.updatedObjectives) {
            updates.updatedObjectives.forEach(obj => {
                if (obj.id) {
                    updatedObjectiveMap.set(obj.id, {
                        ...obj,
                        updatedAt: new Date()
                    });
                }
            });
        }

        // Filter out removed objectives
        const remainingObjectives = goal.objectives.filter(obj =>
            !updates.removeObjectiveIds || !obj.id || !updates.removeObjectiveIds.includes(obj.id)
        );

        // Apply updates to existing objectives
        const updatedObjectives = remainingObjectives.map(obj => {
            if (obj.id && updatedObjectiveMap.has(obj.id)) {
                return {
                    ...obj,
                    ...updatedObjectiveMap.get(obj.id)
                };
            }
            return obj;
        });

        // Combine with new objectives
        const allObjectives = [...updatedObjectives, ...newObjectives];

        // Prepare the updated goal
        const updatedGoal: Partial<Goal> = {
            objectives: allObjectives,
            updatedAt: new Date()
        };

        // Apply other updates
        if (updates.description !== undefined) updatedGoal.description = updates.description;
        if (updates.metadata !== undefined) updatedGoal.metadata = { ...goal.metadata, ...updates.metadata };
        if (updates.status !== undefined) updatedGoal.status = updates.status;
        if (updates.dueDate !== undefined) updatedGoal.dueDate = updates.dueDate === null ? undefined : updates.dueDate;

        // Handle auto status update
        let goalToUpdate = { ...goal, ...updatedGoal };
        if (updates.autoUpdateStatus) {
            goalToUpdate = updateGoalStatus(goalToUpdate);
        }

        // Save the updated goal
        return this.database.updateGoal(id, goalToUpdate);
    }

    /**
     * Mark a goal as complete
     * 
     * @param id Goal ID
     * @returns The updated goal
     */
    async completeGoal(id: UUID): Promise<Goal> {
        logger.debug(`Completing goal: ${id}`);

        return this.updateGoal(id, {
            status: GoalStatus.DONE,
            updatedObjectives: (await this.getGoal(id))?.objectives.map(obj => ({
                ...obj,
                completed: true
            }))
        });
    }

    /**
     * Mark a goal as failed
     * 
     * @param id Goal ID
     * @param reason Optional reason for failure
     * @returns The updated goal
     */
    async failGoal(id: UUID, reason?: string): Promise<Goal> {
        logger.debug(`Marking goal as failed: ${id}`);

        return this.updateGoal(id, {
            status: GoalStatus.FAILED,
            metadata: reason ? { failureReason: reason } : undefined
        });
    }

    /**
     * Cancel a goal
     * 
     * @param id Goal ID
     * @param reason Optional reason for cancellation
     * @returns The updated goal
     */
    async cancelGoal(id: UUID, reason?: string): Promise<Goal> {
        logger.debug(`Canceling goal: ${id}`);

        return this.updateGoal(id, {
            status: GoalStatus.CANCELED,
            metadata: reason ? { cancellationReason: reason } : undefined
        });
    }

    /**
     * Delete a goal
     * 
     * @param id Goal ID
     * @returns Success status
     */
    async deleteGoal(id: UUID): Promise<boolean> {
        logger.debug(`Deleting goal: ${id}`);
        return this.database.deleteGoal(id);
    }

    /**
     * Calculate progress for a goal
     * 
     * @param goal Goal to analyze
     * @returns Progress percentage (0-100)
     */
    calculateProgress(goal: Goal): number {
        return calculateGoalProgress(goal);
    }

    /**
     * Update objective status within a goal
     * 
     * @param goalId Goal ID
     * @param objectiveId Objective ID
     * @param completed New completion status
     * @param progress Optional progress percentage
     * @returns The updated goal
     */
    async updateObjective(
        goalId: UUID,
        objectiveId: UUID,
        completed: boolean,
        progress?: number
    ): Promise<Goal> {
        logger.debug(`Updating objective ${objectiveId} in goal ${goalId}`);

        return this.updateGoal(goalId, {
            updatedObjectives: [{
                id: objectiveId,
                description: '', // Will be ignored since we're updating
                completed,
                progress,
                updatedAt: new Date()
            }],
            autoUpdateStatus: true
        });
    }
} 