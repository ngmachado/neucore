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
 * Result of executing an intent
 */
export interface IntentResult {
    success: boolean;
    data?: any;
    error?: string;
    extras?: Record<string, any>;
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
 * Plugin interface
 */
export interface IPlugin {
    /**
     * Initializes the plugin
     */
    initialize(): Promise<void>;

    /**
     * Returns the intents supported by this plugin
     */
    supportedIntents(): string[];

    /**
     * Executes an intent
     * 
     * @param intent The intent to execute
     * @param context The request context
     */
    execute(intent: Intent, context: RequestContext): Promise<PluginResult>;

    /**
     * Shuts down the plugin
     */
    shutdown(): Promise<void>;

    /**
     * Get the plugin's configuration file path
     * Optional - plugins can provide a configuration file path
     */
    getConfigPath?(): string;

    /**
     * Get the plugin's character definition file paths
     * Optional - plugins can provide character definition file paths
     */
    getCharacterPaths?(): string[];

    /**
     * Get the plugin's directory path
     * Optional - plugins can provide their base directory
     */
    getPluginDirectory?(): string;
} 