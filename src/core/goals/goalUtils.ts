/**
 * Utility functions for goal management
 */

import { Goal, GoalStatus, Objective } from '../../types/goals';
import { UUID } from '../../types';

/**
 * Format a goal as a string representation
 * 
 * @param goal Goal to format
 * @returns Formatted string representation
 */
export function formatGoalAsString(goal: Goal): string {
    const header = `Goal: ${goal.name}${goal.id ? ` (ID: ${goal.id})` : ''}`;
    const description = goal.description ? `Description: ${goal.description}` : '';
    const status = `Status: ${goal.status}`;

    const objectives = goal.objectives.map((objective: Objective) => {
        return `- ${objective.completed ? "[x]" : "[ ]"} ${objective.description}${objective.progress !== undefined ? ` (${objective.progress}%)` :
            objective.completed ? " (DONE)" : " (IN PROGRESS)"
            }`;
    }).join('\n');

    const dates = [];
    if (goal.startDate) dates.push(`Started: ${goal.startDate.toISOString().split('T')[0]}`);
    if (goal.dueDate) dates.push(`Due: ${goal.dueDate.toISOString().split('T')[0]}`);
    if (goal.completedDate) dates.push(`Completed: ${goal.completedDate.toISOString().split('T')[0]}`);

    const datesString = dates.length > 0 ? dates.join(' | ') : '';

    return [header, description, status, `Objectives:\n${objectives}`, datesString]
        .filter(Boolean)
        .join('\n');
}

/**
 * Format multiple goals as a string
 * 
 * @param goals List of goals to format
 * @returns Formatted string representation
 */
export function formatGoalsAsString(goals: Goal[]): string {
    if (goals.length === 0) return 'No goals found.';
    return goals.map(formatGoalAsString).join('\n\n');
}

/**
 * Calculate the overall progress of a goal based on its objectives
 * 
 * @param goal Goal to analyze
 * @returns Progress percentage (0-100)
 */
export function calculateGoalProgress(goal: Goal): number {
    if (!goal.objectives || goal.objectives.length === 0) return 0;

    const totalObjectives = goal.objectives.length;
    const completedObjectives = goal.objectives.filter(obj => obj.completed).length;

    // Calculate progress from objective progress fields if available
    const hasProgressValues = goal.objectives.some(obj => obj.progress !== undefined);

    if (hasProgressValues) {
        const totalProgress = goal.objectives.reduce((sum, obj) => {
            return sum + (obj.progress !== undefined ? obj.progress : (obj.completed ? 100 : 0));
        }, 0);
        return Math.round(totalProgress / totalObjectives);
    }

    // Otherwise calculate based on completed objectives
    return Math.round((completedObjectives / totalObjectives) * 100);
}

/**
 * Check if all objectives in a goal are completed
 * 
 * @param goal Goal to check
 * @returns True if all objectives are completed
 */
export function areAllObjectivesCompleted(goal: Goal): boolean {
    if (!goal.objectives || goal.objectives.length === 0) return false;
    return goal.objectives.every(obj => obj.completed);
}

/**
 * Auto-update a goal's status based on objectives
 * 
 * @param goal Goal to update
 * @returns Updated goal with correct status
 */
export function updateGoalStatus(goal: Goal): Goal {
    const allCompleted = areAllObjectivesCompleted(goal);

    // Don't override FAILED or CANCELED statuses automatically
    if (goal.status === GoalStatus.FAILED || goal.status === GoalStatus.CANCELED) {
        return goal;
    }

    if (allCompleted && goal.status !== GoalStatus.DONE) {
        return {
            ...goal,
            status: GoalStatus.DONE,
            completedDate: new Date()
        };
    } else if (!allCompleted && goal.status === GoalStatus.DONE) {
        return {
            ...goal,
            status: GoalStatus.IN_PROGRESS,
            completedDate: undefined
        };
    }

    return goal;
} 