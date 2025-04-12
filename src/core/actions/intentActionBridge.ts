/**
 * Intent-Action Bridge
 * 
 * Connects the intent system with the action system, allowing intents
 * to be translated into action executions and providing a clear boundary
 * between routing (intents) and execution (actions).
 */
import { ActionContext, ActionResult, IActionManager } from './types';
import { Intent, IntentMiddleware, PluginResult, RequestContext } from '../../mcp/interfaces/plugin';
import { v4 as uuidv4 } from 'uuid';
import { LogLevel, UUID } from '../../types';

/**
 * Configuration for action routing
 */
interface ActionRoute {
    /**
     * Intent action to match
     */
    intentAction: string;

    /**
     * Action ID to execute
     */
    actionId: string;

    /**
     * Function to map intent data to action parameters
     */
    mapParameters: (intentData: any) => Record<string, any>;

    /**
     * Additional context to provide
     */
    contextProvider?: (intent: Intent, reqContext: RequestContext) => Partial<ActionContext>;
}

/**
 * Bridge between intent system and action system
 */
export class IntentActionBridge implements IntentMiddleware {
    /**
     * Action routes mapped by intent action
     */
    private routes: Map<string, ActionRoute> = new Map();

    /**
     * Action manager
     */
    private actionManager: IActionManager;

    /**
     * Logger instance
     */
    private logger: any;

    /**
     * Create a new intent-action bridge
     * @param actionManager Action manager instance
     * @param logger Logger instance
     */
    constructor(actionManager: IActionManager, logger?: any) {
        this.actionManager = actionManager;
        this.logger = logger || console;
    }

    /**
     * Register a route from an intent to an action
     * @param route Route configuration
     */
    registerRoute(route: ActionRoute): void {
        const { intentAction } = route;

        // Validate action exists
        const action = this.actionManager.getAction(route.actionId);
        if (!action) {
            throw new Error(`Cannot register route: Action ${route.actionId} is not registered`);
        }

        // Register the route
        this.routes.set(intentAction, route);

        this.logger.log(LogLevel.INFO, `Registered intent-action route: ${intentAction} -> ${route.actionId}`);
    }

    /**
     * Unregister a route by intent action
     * @param intentAction Intent action to unregister
     */
    unregisterRoute(intentAction: string): void {
        if (this.routes.has(intentAction)) {
            this.routes.delete(intentAction);
            this.logger.log(LogLevel.INFO, `Unregistered intent-action route: ${intentAction}`);
        }
    }

    /**
     * Get all registered routes
     * @returns Array of registered routes
     */
    getRoutes(): { intentAction: string; actionId: string }[] {
        return Array.from(this.routes.entries()).map(([intentAction, route]) => ({
            intentAction,
            actionId: route.actionId
        }));
    }

    /**
     * Check if an intent has a registered action route
     * @param intent Intent to check
     * @returns Whether the intent can be routed to an action
     */
    hasRouteForIntent(intent: Intent): boolean {
        return this.routes.has(intent.action);
    }

    /**
     * Process an intent by routing it to the appropriate action
     * @param intent The intent to process
     * @param context The request context
     * @returns The plugin result
     */
    async processIntent(intent: Intent, context: RequestContext): Promise<PluginResult> {
        // Find the appropriate route
        const route = this.routes.get(intent.action);

        if (!route) {
            return {
                success: false,
                error: `No action route registered for intent: ${intent.action}`
            };
        }

        try {
            // Map intent data to action parameters
            const parameters = route.mapParameters(intent.data || {});

            // Create action context from request context
            const baseContext: Partial<ActionContext> = {
                actionId: uuidv4(),
                userId: context.userId,
                timestamp: context.timestamp || Date.now(),
                sessionId: context.sessionId,
                sourceIntent: {
                    action: intent.action,
                    data: intent.data
                }
            };

            // Add additional context if provided
            const additionalContext = route.contextProvider
                ? route.contextProvider(intent, context)
                : {};

            const actionContext: Partial<ActionContext> = {
                ...baseContext,
                ...additionalContext,
                ...context
            };

            // Execute the action
            const result = await this.actionManager.executeAction(
                route.actionId,
                parameters,
                actionContext
            );

            // Convert action result to plugin result
            return {
                success: result.success,
                data: result.data,
                error: result.error
            };
        } catch (error) {
            this.logger.log(LogLevel.ERROR, `Error processing intent ${intent.action}`, { error });

            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Intent middleware handler - processes intents with registered action routes
     * @param intent The intent to process
     * @param context The request context
     * @returns Plugin result or undefined to let the normal flow continue
     */
    async before(intent: Intent, context: RequestContext): Promise<Intent> {
        // Just pass through the intent for now
        // This could be used to modify or enrich intents if needed
        return intent;
    }

    /**
     * Results middleware handler - intercepts intents with registered action routes
     * @param results The execution results
     * @param context The request context
     * @returns The processed results
     */
    async after(results: PluginResult[], context: RequestContext): Promise<PluginResult[]> {
        // This could be used to process or transform results if needed
        return results;
    }
} 