/**
 * Provider adapter interfaces for MCP
 */

import { Intent, PluginResult, RequestContext } from '../interfaces/plugin';
import { ToolDefinition } from '../types';
import { IPlugin } from '../interfaces/plugin';

/**
 * Provider adapter interface
 * Handles provider-specific knowledge and conversions
 */
export interface ProviderAdapter {
    /**
     * Get the provider name
     */
    getProviderName(): string;

    /**
     * Create an intent for text generation
     * @param prompt The prompt text
     * @returns Intent object for this provider
     */
    createGenerationIntent(prompt: string): Intent;

    /**
     * Extract text from a provider's response
     * @param data Provider-specific response data
     * @returns Extracted text content
     */
    extractResponseText(data: any): string;

    /**
     * Format tools for this provider's expected format
     * @param tools Tool definitions to format
     * @returns Provider-specific tool format
     */
    formatTools(tools: ToolDefinition[]): any;
}

/**
 * Base provider adapter implementation with common functionality
 */
export abstract class BaseProviderAdapter implements ProviderAdapter {
    protected plugin: IPlugin;

    constructor(plugin: IPlugin) {
        this.plugin = plugin;
    }

    abstract getProviderName(): string;
    abstract createGenerationIntent(prompt: string): Intent;
    abstract formatTools(tools: ToolDefinition[]): any;
    abstract extractResponseText(data: any): string;

    /**
     * Execute an intent using this provider
     * @param intent Intent to execute
     * @param context Request context
     * @returns Execution result
     */
    async executeIntent(intent: Intent, context: RequestContext): Promise<PluginResult> {
        return this.plugin.execute(intent, context);
    }
} 