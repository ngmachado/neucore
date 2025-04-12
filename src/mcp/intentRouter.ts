/**
 * Modern Intent Manager for NeuroCore
 * 
 * This file implements a modern intent routing system
 * that uses IntentFilters to match Intents to Handlers.
 */

import { Intent, IntentFlags } from './intent';
import { IntentFilter } from './intentFilter';
import { IntentHandler, IntentContext, IntentResult } from './intentHandler';
import { UUID } from '../types';

// For generating unique IDs
const generateUUID = (): string => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

/**
 * IntentRouter handles routing intents to their handlers
 * through intent matching and filtering.
 */
export class IntentRouter {
    /**
     * All registered intent handlers
     */
    private handlers: IntentHandler[] = [];

    /**
     * Handler lookup by action for faster dispatching
     */
    private handlerLookup: Map<string, IntentHandler[]> = new Map();

    /**
     * Logger instance
     */
    private logger: any;

    /**
     * Create a new IntentRouter
     * 
     * @param logger Optional logger instance
     */
    constructor(logger: any = console) {
        this.logger = logger;
    }

    /**
     * Register an intent handler
     * 
     * @param handler Handler to register
     */
    async registerHandler(handler: IntentHandler): Promise<void> {
        // Initialize the handler
        if (handler.initialize) {
            await handler.initialize();
        }

        // Store the handler
        this.handlers.push(handler);

        // Register all its filters
        const filters = handler.getIntentFilters();
        for (const filter of filters) {
            const actions = filter.getActions();
            for (const action of actions) {
                if (!this.handlerLookup.has(action)) {
                    this.handlerLookup.set(action, []);
                }
                this.handlerLookup.get(action)?.push(handler);
            }
        }

        this.logger.info(`Registered handler: ${handler.constructor.name}`);
    }

    /**
     * Unregister a handler
     * 
     * @param handler Handler to unregister
     */
    async unregisterHandler(handler: IntentHandler): Promise<void> {
        // Call shutdown if implemented
        if (handler.shutdown) {
            await handler.shutdown();
        }

        // Remove from handlers list
        this.handlers = this.handlers.filter(h => h !== handler);

        // Remove from lookup
        for (const [action, handlers] of this.handlerLookup.entries()) {
            this.handlerLookup.set(
                action,
                handlers.filter(h => h !== handler)
            );
        }

        this.logger.info(`Unregistered handler: ${handler.constructor.name}`);
    }

    /**
     * Find handlers for an intent
     * 
     * @param intent Intent to match
     * @returns Array of matching handlers with their matching filters
     */
    private findHandlers(intent: Intent): Array<{ handler: IntentHandler, filter: IntentFilter }> {
        const result: Array<{ handler: IntentHandler, filter: IntentFilter }> = [];

        // First try the lookup for the action
        const possibleHandlers = this.handlerLookup.get(intent.action) || [];

        for (const handler of possibleHandlers) {
            const filters = handler.getIntentFilters();

            for (const filter of filters) {
                if (filter.matches(intent)) {
                    result.push({ handler, filter });
                }
            }
        }

        // Sort by priority (higher first)
        return result.sort((a, b) => b.filter.priority - a.filter.priority);
    }

    /**
     * Send an intent and get results
     * 
     * @param intent Intent to send
     * @param context Execution context
     * @returns Array of results from handlers
     */
    async sendIntent(
        intent: Intent,
        context: Partial<IntentContext> = {}
    ): Promise<IntentResult[]> {
        // Complete the context
        const fullContext: IntentContext = {
            requestId: context.requestId || generateUUID(),
            userId: context.userId || 'anonymous',
            timestamp: context.timestamp || Date.now(),
            ...context
        };

        // Find matching handlers
        const matchingHandlers = this.findHandlers(intent);

        if (matchingHandlers.length === 0) {
            this.logger.warn(`No handlers found for intent: ${intent.action}`);
            return [{ success: false, error: 'No handlers available' }];
        }

        // Execute handlers
        const results: IntentResult[] = [];
        for (const { handler } of matchingHandlers) {
            try {
                const result = await handler.handleIntent(intent, fullContext);
                results.push(result);

                // Stop after first successful handler unless it's a broadcast
                if (result.success && !intent.hasFlag(IntentFlags.BACKGROUND)) {
                    break;
                }
            } catch (error) {
                this.logger.error(`Error executing handler ${handler.constructor.name}: ${error}`);
                results.push({
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }

        return results;
    }

    /**
     * Send a broadcast intent to all matching handlers
     * 
     * @param intent Intent to broadcast
     * @param context Execution context
     * @returns Array of results from all handlers
     */
    async sendBroadcast(
        intent: Intent,
        context: Partial<IntentContext> = {}
    ): Promise<IntentResult[]> {
        // Set broadcast flag
        intent.addFlag(IntentFlags.BACKGROUND);

        // Send to all handlers
        return this.sendIntent(intent, context);
    }

    /**
     * Create a new intent
     * 
     * @param action Intent action
     * @param data Optional data payload
     * @returns New intent instance
     */
    createIntent(action: string, data?: any): Intent {
        return new Intent(action, data);
    }
} 