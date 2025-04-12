/**
 * Anthropic adapter for MCP
 */

import { Intent, PluginResult, RequestContext } from '../interfaces/plugin';
import { ToolDefinition } from '../types';
import { BaseProviderAdapter } from './provider';
import { IPlugin } from '../interfaces/plugin';

/**
 * Adapter for Anthropic Claude API
 * Handles Anthropic-specific formats and conversions
 */
export class AnthropicAdapter extends BaseProviderAdapter {
    /**
     * Create a new Anthropic adapter
     * @param plugin The underlying Anthropic plugin
     */
    constructor(plugin: IPlugin) {
        super(plugin);
    }

    /**
     * Get provider name
     */
    getProviderName(): string {
        return 'anthropic';
    }

    /**
     * Create an intent for text generation with Anthropic
     * @param prompt The prompt text
     * @returns Anthropic-specific intent
     */
    createGenerationIntent(prompt: string): Intent {
        return {
            action: 'anthropic:complete',
            data: { prompt }
        };
    }

    /**
     * Extract text from Anthropic response
     * @param data Anthropic API response data
     * @returns Extracted text content
     */
    extractResponseText(data: any): string {
        if (data.completion) {
            return data.completion; // Claude completion API
        }

        if (data.content && typeof data.content === 'string') {
            return data.content; // Claude messages API
        }

        // Fall back to JSON if format is unknown
        return JSON.stringify(data);
    }

    /**
     * Format tools for Anthropic's expected format
     * @param tools Tool definitions to format
     * @returns Anthropic tool format
     */
    formatTools(tools: ToolDefinition[]): any {
        return tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            input_schema: {
                type: 'object',
                properties: tool.parameters.properties,
                required: tool.parameters.required || []
            }
        }));
    }
} 