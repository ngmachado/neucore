/**
 * Model Intent Protocol (MIP) Implementation
 */

import { IPlugin, PluginResult, RequestContext } from '../mcp/interfaces/plugin';
import { Intent } from '../mcp/intent';
import { MIPIntent } from './interfaces/intent';
import { PluginManager } from './pluginManager';
import { ProviderManager } from './providerManager';
import { generateUUID } from '../utils';
import { getLogger } from '../core/logging';
import { ModelSelectionPlugin } from './plugins/modelSelectionPlugin';
import { ModelRegistry } from './registry/modelRegistry';
import { ModelProvider } from './types/modelSelection';

/**
 * Configuration for MIP
 */
interface MIPConfig {
    // Configuration options
}

/**
 * Model Intent Protocol
 * Central orchestrator for intent handling
 */
export class MIP {
    private pluginManager: PluginManager;
    private providerManager: ProviderManager;
    private modelRegistry: ModelRegistry;
    private config: MIPConfig;
    private logger: any;

    constructor(config: MIPConfig = {}) {
        this.config = config;
        this.logger = getLogger('mip');
        this.pluginManager = new PluginManager();
        this.providerManager = new ProviderManager();
        this.modelRegistry = new ModelRegistry();

        // Register built-in plugins
        this.registerBuiltInPlugins();
    }

    /**
     * Initialize MIP
     */
    public async initialize(): Promise<void> {
        // Initialize components
        await this.providerManager.initialize();

        // After provider initialization, update the model registry
        // with information about which providers are available
        this.syncProvidersWithRegistry();
    }

    /**
     * Synchronize available providers with the model registry
     */
    private syncProvidersWithRegistry(): void {
        try {
            const availableProviders = this.providerManager.getAvailableProviders();
            this.logger.info(`Synchronizing providers with model registry: ${availableProviders.join(', ')}`);

            // Convert provider names to ModelProvider type and pass them to the registry
            const providers: ModelProvider[] = availableProviders.map(name => name as ModelProvider);

            // Update the registry with available providers
            this.modelRegistry.setAvailableProviders(providers);
        } catch (error) {
            this.logger.warn(`Failed to sync providers with registry: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Shutdown MIP
     */
    public async shutdown(): Promise<void> {
        // Shutdown components
        await this.providerManager.shutdown();
    }

    /**
     * Register a plugin
     * @param plugin Plugin to register
     */
    public registerPlugin(plugin: IPlugin): void {
        this.pluginManager.registerPlugin(plugin);
    }

    /**
     * Get the model registry
     */
    public getModelRegistry(): ModelRegistry {
        return this.modelRegistry;
    }

    /**
     * Execute an intent
     * @param intent Intent to execute (can be MIPIntent or the more complex MCP Intent)
     */
    public async executeIntent(intent: MIPIntent | Intent): Promise<any> {
        // Handle both simple MIPIntent and complex Intent objects
        const action = intent.action;
        const data = 'data' in intent ? intent.data : {};

        const plugin = this.pluginManager.findPluginForIntent(action);
        if (!plugin) {
            throw new Error(`No plugin found for intent action: ${action}`);
        }

        // Convert to standard format for plugin execution
        const standardIntent: { action: string, data: any } = { action, data };

        return plugin.execute(standardIntent, {
            requestId: generateUUID(),
            userId: 'system',
            mip: this
        });
    }

    /**
     * Register built-in plugins
     */
    private registerBuiltInPlugins(): void {
        // Register the model selection plugin with shared registry
        const modelSelectionPlugin = new ModelSelectionPlugin({
            logger: this.logger,
            modelRegistry: this.modelRegistry
        });
        this.registerPlugin(modelSelectionPlugin);

        // Initialize model selection plugin
        modelSelectionPlugin.initialize()
            .catch(error => this.logger.error(`Failed to initialize ModelSelectionPlugin: ${error.message}`));
    }
} 