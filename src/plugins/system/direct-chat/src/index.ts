/**
 * DirectChat Plugin adapted for discovery system
 */

import { DirectChatPlugin } from '../../../directChatPlugin';
import { MCP } from '../../../../mcp/mcp';
import { IPlugin, PluginResult, RequestContext } from '../../../../mcp/interfaces/plugin';
import { Intent } from '../../../../mcp/intent';
import { ReasoningMethod } from '../../../../core/reasoning/types';

// Declare global MCP instance for the adapter
declare global {
    var mcpInstance: MCP | undefined;
}

/**
 * Create a DirectChatPlugin instance from discovery system
 * This version is specifically configured to use Socratic reasoning
 */
export default class DiscoveryDirectChatPlugin implements IPlugin {
    private plugin: DirectChatPlugin;
    private logger: any;

    constructor(options: { logger: any, config: any }) {
        this.logger = options.logger;

        // Get MCP instance - In a real implementation, you'd need to handle this better
        if (!global.mcpInstance) {
            throw new Error('MCP instance not available globally');
        }
        const mcp = global.mcpInstance;

        // Create a more detailed Socratic reasoning configuration
        const configWithSocratic = {
            ...options.config,
            // Use model from configuration or default
            model: options.config?.model || 'gpt-4o',
            reasoning: {
                ...(options.config?.reasoning || {}),
                // Explicitly set the method as a string to avoid enum serialization issues
                method: 'socratic', // Use lowercase string to match the expected enum value
                // Increase temperature slightly for more creative Socratic questioning
                temperature: 0.8,
                // Increase token limit to allow for deeper reasoning
                maxTokens: 2000
            }
        };

        this.logger.info(`Initializing Socratic DirectChatPlugin with model: ${configWithSocratic.model}`);
        this.logger.info(`Socratic reasoning method type: ${typeof ReasoningMethod.SOCRATIC}`);
        this.logger.info(`Socratic reasoning method value: ${ReasoningMethod.SOCRATIC}`);
        this.logger.info(`Config reasoning method value: ${configWithSocratic.reasoning.method}`);
        this.logger.info('Using Socratic reasoning method for DirectChatPlugin');

        // Create the underlying plugin instance
        this.plugin = new DirectChatPlugin({
            logger: options.logger,
            mcp,
            config: configWithSocratic,
        });
    }

    /**
     * Initialize the plugin
     */
    async initialize(): Promise<void> {
        this.logger.info('Initializing Socratic DirectChat plugin');
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
        // If this is a message intent, intercept to add Socratic reasoning
        if (intent.action === 'directChat:message') {
            this.logger.info('Executing Socratic DirectChat message intent');
            this.logger.info(`Setting reasoning method to: ${ReasoningMethod.SOCRATIC}`);
            this.logger.info(`ReasoningMethod.SOCRATIC type: ${typeof ReasoningMethod.SOCRATIC}`);
            this.logger.info(`ReasoningMethod.SOCRATIC value: ${ReasoningMethod.SOCRATIC}`);
            this.logger.info(`ReasoningMethod enum mapping: ${JSON.stringify(ReasoningMethod)}`);

            // Create a completely new intent with the method directly in the data
            // Use a consistent property name and pass the string value to avoid serialization issues
            const modifiedIntent = new Intent(
                'directChat:message',
                {
                    ...intent.data,
                    // Use consistent property name "reasoningMethod" and pass as string value
                    reasoningMethod: 'socratic'
                }
            );

            this.logger.info(`Modified intent data: ${JSON.stringify(modifiedIntent.data)}`);
            this.logger.info(`reasoningMethod type: ${typeof modifiedIntent.data.reasoningMethod}`);
            this.logger.info(`reasoningMethod value: ${modifiedIntent.data.reasoningMethod}`);

            return this.plugin.execute(modifiedIntent, context);
        }
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