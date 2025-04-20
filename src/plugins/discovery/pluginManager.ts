/**
 * Plugin Discovery System - MCP PluginManager Adapter
 * 
 * Provides an adapter layer to integrate the discovery system
 * with the existing MCP PluginManager.
 */

import { Intent } from '../../mcp/intent';
import { IPlugin, PluginResult, RequestContext } from '../../mcp/interfaces/plugin';
import { PluginDiscovery, PluginDiscoveryOptions } from './index';
import { PluginManager as MCPPluginManager } from '../../mcp/pluginManager';
import * as path from 'path';

/**
 * Plugin manager adapter options
 */
export interface PluginManagerAdapterOptions extends PluginDiscoveryOptions {
    /**
     * The original plugin manager to adapt
     */
    originalPluginManager: MCPPluginManager;

    /**
     * Whether to use the new priority-based resolver
     */
    usePriorityResolver?: boolean;

    /**
     * Whether to load system plugins
     */
    loadSystemPlugins?: boolean;

    /**
     * Whether to load user plugins
     */
    loadUserPlugins?: boolean;

    /**
     * Whether to log debug information
     */
    debug?: boolean;
}

/**
 * Plugin manager adapter
 * Adapts the new discovery system to the original plugin manager interface
 */
export class PluginManagerAdapter {
    private originalManager: MCPPluginManager;
    private discovery: PluginDiscovery;
    private logger: any;

    constructor(options: PluginManagerAdapterOptions) {
        this.originalManager = options.originalPluginManager;
        this.logger = options.logger || console;

        // Create the discovery system
        this.discovery = new PluginDiscovery({
            systemPluginDirectory: options.systemPluginDirectory || path.join(__dirname, '..', 'system'),
            userPluginDirectory: options.userPluginDirectory || path.join(__dirname, '..', 'custom'),
            additionalDirectories: options.additionalDirectories,
            intentHandlerConfig: options.intentHandlerConfig,
            usePriorityResolver: options.usePriorityResolver,
            loadSystemPlugins: options.loadSystemPlugins,
            loadUserPlugins: options.loadUserPlugins,
            debug: options.debug,
            enabled: options.enabled,
            logger: this.logger
        });

        this.logger.info('Plugin manager adapter created');
    }

    /**
     * Initialize the adapter
     */
    async initialize(): Promise<void> {
        await this.discovery.initialize();
        this.logger.info('Plugin manager adapter initialized');
    }

    /**
     * Register a plugin
     * This will register with both the original manager and the discovery system
     */
    async registerPlugin(plugin: IPlugin): Promise<void> {
        // Always register with the original manager for backward compatibility
        await this.originalManager.registerPlugin(plugin);

        // We don't register with discovery system here, as plugins should be 
        // discovered via manifest files instead
        this.logger.debug(`Plugin registered via adapter: ${plugin.supportedIntents()[0].split(':')[0]}`);
    }

    /**
     * Execute an intent
     * Uses the discovery system to find the appropriate plugin if enabled,
     * otherwise falls back to the original manager
     */
    async executeIntent(intent: Intent, context: RequestContext): Promise<PluginResult> {
        // Try to find a plugin using the discovery system if enabled
        const plugin = this.discovery.findPluginForIntent(intent);

        if (plugin) {
            this.logger.debug(`Executing intent ${intent.action} with discovery plugin`);
            return await plugin.execute(intent, context);
        }

        // Fall back to the original manager
        this.logger.debug(`Falling back to original manager for intent ${intent.action}`);
        return await this.originalManager.executeIntent(intent, context);
    }

    /**
     * Find a plugin that can handle the given intent
     */
    findPluginForIntent(intent: Intent): IPlugin | undefined {
        // Try discovery system first
        const plugin = this.discovery.findPluginForIntent(intent);
        if (plugin) {
            return plugin;
        }

        // Fall back to original manager
        return this.originalManager.findPluginForIntent(intent);
    }

    /**
     * Get a plugin by ID
     */
    getPlugin(pluginId: string): IPlugin | undefined {
        // Try discovery system first
        const plugin = this.discovery.getPlugin(pluginId);
        if (plugin) {
            return plugin;
        }

        // Fall back to original manager
        return this.originalManager.getPlugin(pluginId);
    }

    /**
     * Get all plugins
     */
    getPlugins(): Map<string, IPlugin> {
        const result = new Map<string, IPlugin>();

        // Add plugins from original manager
        const originalPlugins = this.originalManager.getPlugins();
        for (const [id, plugin] of originalPlugins.entries()) {
            // Skip if this plugin is substituted by a discovery plugin
            if (this.discovery.isPluginSubstituted(id)) {
                const substitutingPlugin = this.discovery.getSubstitutingPlugin(id);
                if (substitutingPlugin) {
                    this.logger.debug(`Plugin ${id} is substituted by another plugin`);
                    continue;
                }
            }

            result.set(id, plugin);
        }

        // Add plugins from discovery system
        const discoveryPlugins = this.discovery.getAllPlugins();
        for (const [id, plugin] of discoveryPlugins.entries()) {
            result.set(id, plugin);
        }

        return result;
    }
} 