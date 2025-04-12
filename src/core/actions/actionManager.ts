/**
 * Action Manager
 * 
 * Manages the registry of actions and handles execution, authorization,
 * validation, and logging of actions.
 */
import { v4 as uuidv4 } from 'uuid';
import {
    Action,
    ActionContext,
    ActionDefinition,
    ActionParameter,
    ActionResult,
    IActionManager
} from './types';
import { LogLevel } from '../../types';

/**
 * Action Manager implementation
 */
export class ActionManager implements IActionManager {
    /**
     * Registry of available actions
     */
    private actions: Map<string, Action> = new Map();

    /**
     * Logger instance
     */
    private logger: any;

    /**
     * Authorization service
     */
    private authService: any;

    /**
     * Create a new action manager
     * @param options Configuration options
     */
    constructor(options: {
        logger?: any;
        authService?: any;
    } = {}) {
        this.logger = options.logger || console;
        this.authService = options.authService;
    }

    /**
     * Register a new action
     * @param action Action to register
     */
    registerAction(action: Action): void {
        if (!action || !action.definition || !action.definition.id) {
            throw new Error('Invalid action: missing definition or ID');
        }

        const id = action.definition.id;

        if (this.actions.has(id)) {
            throw new Error(`Action with ID '${id}' is already registered`);
        }

        // Validate action definition
        this.validateActionDefinition(action.definition);

        // Register the action
        this.actions.set(id, action);

        this.logger.log(LogLevel.INFO, `Registered action: ${id}`, {
            name: action.definition.name,
            category: action.definition.category,
            parameterCount: action.definition.parameters.length
        });
    }

    /**
     * Unregister an action
     * @param actionId ID of the action to unregister
     */
    unregisterAction(actionId: string): void {
        if (!this.actions.has(actionId)) {
            this.logger.log(LogLevel.WARN, `Attempted to unregister unknown action: ${actionId}`);
            return;
        }

        this.actions.delete(actionId);
        this.logger.log(LogLevel.INFO, `Unregistered action: ${actionId}`);
    }

    /**
     * Get an action by ID
     * @param actionId Action ID
     * @returns The action or undefined if not found
     */
    getAction(actionId: string): Action | undefined {
        return this.actions.get(actionId);
    }

    /**
     * Get all registered actions, optionally filtered by category
     * @param category Optional category to filter by
     * @returns Array of matching actions
     */
    getActions(category?: string): Action[] {
        const allActions = Array.from(this.actions.values());

        if (!category) {
            return allActions;
        }

        return allActions.filter(action =>
            action.definition.category === category
        );
    }

    /**
     * Check if an action is authorized for the given context
     * @param action Action to check
     * @param context Context to check against
     * @returns Whether the action is authorized
     */
    async isAuthorized(action: Action, context: ActionContext): Promise<boolean> {
        if (!action.definition.enabled) {
            return false;
        }

        // If no auth service, assume authorized
        if (!this.authService) {
            return true;
        }

        try {
            // Check each required permission
            for (const permission of action.definition.requiredPermissions) {
                const hasPermission = await this.authService.checkPermission(
                    context.agentId,
                    context.userId,
                    permission
                );

                if (!hasPermission) {
                    this.logger.log(LogLevel.WARN, `Authorization failed for action: ${action.definition.id}`, {
                        permission,
                        agentId: context.agentId,
                        userId: context.userId
                    });
                    return false;
                }
            }

            return true;
        } catch (error) {
            this.logger.log(LogLevel.ERROR, `Error during action authorization: ${error}`, {
                actionId: action.definition.id,
                error
            });
            return false;
        }
    }

    /**
     * Execute an action with the given parameters and context
     * @param actionId ID of the action to execute
     * @param parameters Parameters for the action
     * @param context Context for execution
     * @returns Result of the action execution
     */
    async executeAction(
        actionId: string,
        parameters: Record<string, any>,
        context: Partial<ActionContext>
    ): Promise<ActionResult> {
        // Find the action
        const action = this.actions.get(actionId);

        if (!action) {
            return {
                success: false,
                error: `Unknown action: ${actionId}`
            };
        }

        // Complete the context
        const fullContext: ActionContext = {
            actionId: context.actionId || uuidv4(),
            agentId: context.agentId || '',
            userId: context.userId || '',
            timestamp: context.timestamp || Date.now(),
            ...context
        };

        // Record the start time for performance metrics
        const startTime = performance.now();

        try {
            // Check authorization
            const authorized = await this.isAuthorized(action, fullContext);

            if (!authorized) {
                return {
                    success: false,
                    error: `Not authorized to execute action: ${actionId}`
                };
            }

            // Validate parameters
            const validationResult = this.validateParameters(
                parameters,
                action.definition.parameters
            );

            if (!validationResult.valid) {
                return {
                    success: false,
                    error: `Parameter validation failed: ${validationResult.error}`
                };
            }

            // Apply default values for missing parameters
            const processedParams = this.applyDefaultParameters(
                parameters,
                action.definition.parameters
            );

            // Log action execution
            this.logger.log(LogLevel.INFO, `Executing action: ${actionId}`, {
                context: {
                    actionId: fullContext.actionId,
                    agentId: fullContext.agentId,
                    userId: fullContext.userId
                },
                parameterCount: Object.keys(processedParams).length
            });

            // Execute the action
            const result = await action.execute(processedParams, fullContext);

            // Calculate execution time
            const executionTime = performance.now() - startTime;

            // Add metadata if not present
            if (!result.metadata) {
                result.metadata = {};
            }

            // Add execution time to metadata
            result.metadata.executionTimeMs = executionTime;

            // Log execution result
            this.logger.log(
                result.success ? LogLevel.INFO : LogLevel.ERROR,
                `Action execution ${result.success ? 'succeeded' : 'failed'}: ${actionId}`,
                {
                    success: result.success,
                    executionTimeMs: executionTime,
                    error: result.error
                }
            );

            return result;
        } catch (error) {
            // Calculate execution time even for errors
            const executionTime = performance.now() - startTime;

            // Log the error
            this.logger.log(LogLevel.ERROR, `Exception during action execution: ${actionId}`, {
                error,
                executionTimeMs: executionTime
            });

            // Return error result
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                metadata: {
                    executionTimeMs: executionTime,
                    exception: true
                }
            };
        }
    }

    /**
     * Validate an action definition
     * @param definition Action definition to validate
     * @throws Error if the definition is invalid
     */
    private validateActionDefinition(definition: ActionDefinition): void {
        // Required fields
        if (!definition.id) throw new Error('Action definition missing ID');
        if (!definition.name) throw new Error('Action definition missing name');
        if (!definition.description) throw new Error('Action definition missing description');

        // Validate parameters
        if (!Array.isArray(definition.parameters)) {
            throw new Error('Action parameters must be an array');
        }

        // Check for duplicate parameter names
        const paramNames = new Set<string>();
        for (const param of definition.parameters) {
            if (!param.name) {
                throw new Error('Parameter missing name');
            }

            if (paramNames.has(param.name)) {
                throw new Error(`Duplicate parameter name: ${param.name}`);
            }

            paramNames.add(param.name);
        }

        // Check required permissions is array
        if (!Array.isArray(definition.requiredPermissions)) {
            throw new Error('Required permissions must be an array');
        }

        // Check effects is array
        if (!Array.isArray(definition.effects)) {
            throw new Error('Effects must be an array');
        }
    }

    /**
     * Validate parameters against their definitions
     * @param parameters Parameters to validate
     * @param parameterDefs Parameter definitions
     * @returns Validation result
     */
    private validateParameters(
        parameters: Record<string, any>,
        parameterDefs: ActionParameter[]
    ): { valid: boolean; error?: string } {
        // Check for required parameters
        for (const paramDef of parameterDefs) {
            if (paramDef.required && !(paramDef.name in parameters)) {
                return {
                    valid: false,
                    error: `Missing required parameter: ${paramDef.name}`
                };
            }
        }

        // Validate each provided parameter
        for (const [name, value] of Object.entries(parameters)) {
            // Find the parameter definition
            const paramDef = parameterDefs.find(p => p.name === name);

            // Skip validation for parameters not in the definition
            if (!paramDef) continue;

            // Check type
            if (paramDef.type === 'string' && typeof value !== 'string') {
                return {
                    valid: false,
                    error: `Parameter ${name} must be a string`
                };
            } else if (paramDef.type === 'number' && typeof value !== 'number') {
                return {
                    valid: false,
                    error: `Parameter ${name} must be a number`
                };
            } else if (paramDef.type === 'boolean' && typeof value !== 'boolean') {
                return {
                    valid: false,
                    error: `Parameter ${name} must be a boolean`
                };
            } else if (paramDef.type === 'object' && (typeof value !== 'object' || Array.isArray(value))) {
                return {
                    valid: false,
                    error: `Parameter ${name} must be an object`
                };
            } else if (paramDef.type === 'array' && !Array.isArray(value)) {
                return {
                    valid: false,
                    error: `Parameter ${name} must be an array`
                };
            }

            // Check enum values
            if (paramDef.enum && Array.isArray(paramDef.enum) && !paramDef.enum.includes(value)) {
                return {
                    valid: false,
                    error: `Parameter ${name} must be one of: ${paramDef.enum.join(', ')}`
                };
            }

            // Run custom validation function if provided
            if (paramDef.validate) {
                const validationResult = paramDef.validate(value);

                if (validationResult !== true && validationResult !== undefined) {
                    return {
                        valid: false,
                        error: typeof validationResult === 'string'
                            ? validationResult
                            : `Invalid value for parameter ${name}`
                    };
                }
            }
        }

        return { valid: true };
    }

    /**
     * Apply default values for missing parameters
     * @param parameters Provided parameters
     * @param parameterDefs Parameter definitions
     * @returns Parameters with defaults applied
     */
    private applyDefaultParameters(
        parameters: Record<string, any>,
        parameterDefs: ActionParameter[]
    ): Record<string, any> {
        const result = { ...parameters };

        for (const paramDef of parameterDefs) {
            // Skip if parameter is provided
            if (paramDef.name in result) continue;

            // Apply default value if available
            if ('defaultValue' in paramDef) {
                result[paramDef.name] = paramDef.defaultValue;
            }
        }

        return result;
    }
} 