/**
 * OpenAI adapter for MCP
 */

import { Intent, PluginResult, RequestContext } from '../interfaces/plugin';
import { ToolDefinition } from '../types';
import { BaseProviderAdapter } from './provider';
import { IPlugin } from '../interfaces/plugin';

/**
 * Adapter for OpenAI API
 * Handles OpenAI-specific formats and conversions
 */
export class OpenAIAdapter extends BaseProviderAdapter {
    /**
     * Create a new OpenAI adapter
     * @param plugin The underlying OpenAI plugin
     */
    constructor(plugin: IPlugin) {
        super(plugin);
    }

    /**
     * Get provider name
     */
    getProviderName(): string {
        return 'openai';
    }

    /**
     * Create an intent for text generation with OpenAI
     * @param prompt The prompt text
     * @returns OpenAI-specific intent
     */
    createGenerationIntent(prompt: string): Intent {
        return {
            action: 'openai:chat',
            data: {
                messages: [{ role: 'user', content: prompt }]
            }
        };
    }

    /**
     * Extract text from OpenAI response
     * @param data OpenAI API response data
     * @returns Extracted text content
     */
    extractResponseText(data: any): string {
        if (data.choices && data.choices[0]?.message?.content) {
            return data.choices[0].message.content;
        }

        // Fall back to JSON if format is unknown
        return JSON.stringify(data);
    }

    /**
     * Format tools for OpenAI's expected format
     * @param tools Tool definitions to format
     * @returns OpenAI tool format
     */
    formatTools(tools: ToolDefinition[]): any {
        return tools.map(tool => ({
            type: 'function',
            function: {
                name: tool.name,
                description: tool.description,
                parameters: {
                    type: 'object',
                    properties: tool.parameters.properties,
                    required: tool.parameters.required || []
                }
            }
        }));
    }
} 