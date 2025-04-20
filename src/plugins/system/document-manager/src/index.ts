/**
 * Document Manager Plugin adapted for discovery system
 */

import { DocumentManagerPlugin } from '../../../documentManagerPlugin';
import { IPlugin, PluginResult, RequestContext } from '../../../../mcp/interfaces/plugin';
import { Intent } from '../../../../mcp/intent';

/**
 * Create a DocumentManagerPlugin instance from discovery system
 */
export default class DiscoveryDocumentManagerPlugin implements IPlugin {
    private plugin: DocumentManagerPlugin;

    constructor(options: { logger: any, config: any }) {
        // Create the underlying plugin instance
        this.plugin = new DocumentManagerPlugin(options.config);
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