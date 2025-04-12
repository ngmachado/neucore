/**
 * Plugin interfaces for the Message Content Protocol (MCP)
 */

import { UUID } from '../../types';

/**
 * Request context for plugin operations
 */
export interface RequestContext {
    requestId: string;
    userId: UUID;
    sessionId?: string;
    timestamp?: number;
    [key: string]: any;
}

/**
 * Intent to be executed by a plugin
 */
export interface Intent {
    /**
     * The action to be performed, typically namespaced
     * e.g., 'anthropic:generate', 'openai:complete', 'tools:analyze'
     */
    action: string;

    /**
     * Additional data needed to execute the intent
     */
    data?: any;
}

/**
 * Result of a plugin execution
 */
export interface PluginResult {
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
 * Middleware for intent processing
 */
export interface IntentMiddleware {
    /**
     * Process an intent before it's dispatched
     * @param intent The intent to process
     * @param context The request context
     * @returns The processed intent
     */
    before?(intent: Intent, context: RequestContext): Promise<Intent>;

    /**
     * Process results after intent execution
     * @param results The execution results
     * @param context The request context
     * @returns The processed results
     */
    after?(results: PluginResult[], context: RequestContext): Promise<PluginResult[]>;
}

/**
 * Interface for plugins
 */
export interface IPlugin {
    /**
     * Get the list of intent actions supported by this plugin
     * @returns Array of supported intent actions
     */
    supportedIntents(): string[];

    /**
     * Initialize the plugin
     * Called when the plugin is registered
     */
    initialize?(): Promise<void>;

    /**
     * Shutdown the plugin
     * Called when the plugin is unregistered
     */
    shutdown?(): Promise<void>;

    /**
     * Execute an intent
     * @param intent The intent to execute
     * @param context The request context
     * @returns The execution result
     */
    execute(intent: Intent, context: RequestContext): Promise<PluginResult>;
} 