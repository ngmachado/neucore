/**
 * Intent Handler System for NeuroCore
 * 
 * This file defines interfaces for components that can
 * handle intents via the intent system.
 */

import { Intent } from './intent';
import { IntentFilter } from './intentFilter';

/**
 * Result of intent handling
 */
export interface IntentResult {
    /**
     * Whether the intent was successfully handled
     */
    success: boolean;

    /**
     * Optional result data
     */
    data?: any;

    /**
     * Optional error message in case of failure
     */
    error?: string;
}

/**
 * Context for intent execution
 */
export interface IntentContext {
    /**
     * Request ID for tracing
     */
    requestId: string;

    /**
     * User ID making the request
     */
    userId: string;

    /**
     * Session ID if applicable
     */
    sessionId?: string;

    /**
     * Timestamp of the request
     */
    timestamp?: number;

    /**
     * Additional context properties
     */
    [key: string]: any;
}

/**
 * Interface for components that can handle intents
 */
export interface IntentHandler {
    /**
     * Get intent filters that this handler supports
     */
    getIntentFilters(): IntentFilter[];

    /**
     * Handle an intent
     * 
     * @param intent Intent to handle
     * @param context Execution context
     * @returns Result of handling the intent
     */
    handleIntent(intent: Intent, context: IntentContext): Promise<IntentResult>;

    /**
     * Initialize the handler
     * Called when the handler is registered
     */
    initialize?(): Promise<void>;

    /**
     * Shutdown the handler
     * Called when the handler is unregistered
     */
    shutdown?(): Promise<void>;
}

/**
 * Base class for intent handlers with simple filter creation
 */
export abstract class BaseIntentHandler implements IntentHandler {
    /**
     * The intent filters for this handler
     */
    protected filters: IntentFilter[] = [];

    /**
     * Create an intent filter for this handler
     * 
     * @param action Action to match
     * @param priority Optional priority 
     * @returns The created filter for chaining
     */
    protected createFilter(action: string, priority: number = 0): IntentFilter {
        const filter = new IntentFilter(priority);
        filter.addAction(action);
        this.filters.push(filter);
        return filter;
    }

    /**
     * Get the intent filters for this handler
     */
    getIntentFilters(): IntentFilter[] {
        return this.filters;
    }

    /**
     * Handle an intent (to be implemented by subclasses)
     */
    abstract handleIntent(intent: Intent, context: IntentContext): Promise<IntentResult>;
} 