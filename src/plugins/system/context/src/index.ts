/**
 * Context Plugin adapted for discovery system
 */

import { ContextPlugin } from '../../../contextPlugin';
import { MCP } from '../../../../mcp/mcp';
import { IPlugin, PluginResult, RequestContext } from '../../../../mcp/interfaces/plugin';
import { Intent } from '../../../../mcp/intent';

// Declare global MCP instance for the adapter
declare global {
    var mcpInstance: MCP | undefined;
}

/**
 * Create a ContextPlugin instance from discovery system
 */
export default class DiscoveryContextPlugin implements IPlugin {
    private plugin: ContextPlugin;

    constructor(options: { logger: any, config: any }) {
        // Get MCP instance - In a real implementation, you'd need to handle this better
        if (!global.mcpInstance) {
            throw new Error('MCP instance not available globally');
        }
        const mcp = global.mcpInstance;

        // Create the underlying plugin instance
        this.plugin = new ContextPlugin({
            logger: options.logger,
            mcp
        });
    }

    /**
     * Initialize the plugin
     */
    async initialize(): Promise<void> {
        return this.plugin.initialize();
    }

    /**
     * Get supported intents from the plugin
     */
    supportedIntents(): string[] {
        return this.plugin.supportedIntents();
    }

    /**
     * Execute an intent
     */
    async execute(intent: Intent, context: RequestContext): Promise<PluginResult> {
        return this.plugin.execute(intent, context);
    }

    /**
     * Shutdown the plugin
     */
    async shutdown(): Promise<void> {
        if (this.plugin.shutdown) {
            return this.plugin.shutdown();
        }
    }
} 