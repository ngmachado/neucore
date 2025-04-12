/**
 * Action system types
 * 
 * Defines the structure for actions that can be executed by agents.
 * Actions represent concrete, executable operations with defined parameters,
 * permissions and effects, complementing the intent routing system.
 */
import { UUID } from '../../types';

/**
 * Context available during action execution
 */
export interface ActionContext {
    /**
     * Unique identifier for this action execution
     */
    actionId: UUID;

    /**
     * Agent executing the action
     */
    agentId: UUID;

    /**
     * User on whose behalf the action is being executed
     */
    userId: UUID;

    /**
     * Session identifier
     */
    sessionId?: string;

    /**
     * When the action execution started
     */
    timestamp: number;

    /**
     * Original intent that triggered this action (if any)
     */
    sourceIntent?: {
        action: string;
        data?: any;
    };

    /**
     * Additional context data
     */
    [key: string]: any;
}

/**
 * Parameter definition for an action
 */
export interface ActionParameter {
    /**
     * Name of the parameter
     */
    name: string;

    /**
     * Description of the parameter
     */
    description: string;

    /**
     * Whether the parameter is required
     */
    required: boolean;

    /**
     * Default value if not provided
     */
    defaultValue?: any;

    /**
     * Type of the parameter
     */
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';

    /**
     * For array or object types, the schema of items/properties
     */
    schema?: any;

    /**
     * For validated parameters, allowed values
     */
    enum?: any[];

    /**
     * Validation function for the parameter
     */
    validate?: (value: any) => boolean | string;
}

/**
 * Action definition describing what an action does and how to execute it
 */
export interface ActionDefinition {
    /**
     * Unique identifier for this action
     */
    id: string;

    /**
     * Human-readable name of the action
     */
    name: string;

    /**
     * Detailed description of what the action does
     */
    description: string;

    /**
     * Category or group this action belongs to
     */
    category?: string;

    /**
     * List of parameters this action accepts
     */
    parameters: ActionParameter[];

    /**
     * Types of effects this action has (e.g., 'read', 'write', 'network')
     */
    effects: string[];

    /**
     * Required permissions to execute this action
     */
    requiredPermissions: string[];

    /**
     * Whether the action is enabled
     */
    enabled: boolean;

    /**
     * Whether the action appears in help/discovery
     */
    visible: boolean;
}

/**
 * Result of an action execution
 */
export interface ActionResult {
    /**
     * Whether the action was successfully executed
     */
    success: boolean;

    /**
     * Result data from the action
     */
    data?: any;

    /**
     * Error message if the action failed
     */
    error?: string;

    /**
     * Additional metadata about the execution
     */
    metadata?: {
        /**
         * Duration of execution in milliseconds
         */
        executionTimeMs?: number;

        /**
         * Resources used during execution
         */
        resourcesUsed?: {
            [key: string]: number;
        };

        /**
         * Trace or execution path information
         */
        trace?: any[];

        /**
         * Any other execution metadata
         */
        [key: string]: any;
    };
}

/**
 * Function signature for action execution
 */
export type ActionExecutor = (
    parameters: Record<string, any>,
    context: ActionContext
) => Promise<ActionResult>;

/**
 * Complete action with definition and executor
 */
export interface Action {
    /**
     * Definition of the action
     */
    definition: ActionDefinition;

    /**
     * Function that executes the action
     */
    execute: ActionExecutor;
}

/**
 * Interface for action managers that register and execute actions
 */
export interface IActionManager {
    /**
     * Register a new action
     */
    registerAction(action: Action): void;

    /**
     * Unregister an action by ID
     */
    unregisterAction(actionId: string): void;

    /**
     * Get an action by ID
     */
    getAction(actionId: string): Action | undefined;

    /**
     * Get all registered actions, optionally filtered by category
     */
    getActions(category?: string): Action[];

    /**
     * Check if a given action is authorized for the context
     */
    isAuthorized(action: Action, context: ActionContext): Promise<boolean>;

    /**
     * Execute an action with given parameters and context
     */
    executeAction(
        actionId: string,
        parameters: Record<string, any>,
        context: Partial<ActionContext>
    ): Promise<ActionResult>;
} 