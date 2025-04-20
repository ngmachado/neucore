/**
 * Plugin Discovery System - Main Entry Point
 * 
 * Provides a unified interface for the plugin discovery and 
 * priority-based resolution system.
 */

import * as path from 'path';
import { IPlugin } from '../../mcp/interfaces/plugin';
import { Intent } from '../../mcp/intent';
import { PluginLoader, PluginLoaderOptions } from './loader';
import { PriorityResolver, IntentHandlerMappingConfig } from './priorityResolver';
import { PluginRegistrationInfo } from './manifest';

/**
 * Plugin discovery system options
 */
export interface PluginDiscoveryOptions {
    /**
     * System plugin directory
     */
    systemPluginDirectory?: string;

    /**
     * User plugin directory
     */
    userPluginDirectory?: string;

    /**
     * Additional plugin directories
     */
    additionalDirectories?: string[];

    /**
     * User configuration for intent handler mappings
     */
    intentHandlerConfig?: IntentHandlerMappingConfig;

    /**
     * Whether to enable the discovery system
     * If false, the discovery system will not be used
     * and will just pass through to the original plugin manager
     */
    enabled?: boolean;

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

    /**
     * Logger instance
     */
    logger?: any;
}

/**
 * Plugin discovery system
 * Provides a unified interface for plugin discovery and resolution
 */
export class PluginDiscovery {
    private pluginLoader: PluginLoader;
    private priorityResolver: PriorityResolver;
    private enabled: boolean;
    private logger: any;
    private usePriorityResolver: boolean;
    private debug: boolean;

    /**
     * Map of loaded plugins by ID
     */
    private loadedPlugins: Map<string, IPlugin> = new Map();

    constructor(options: PluginDiscoveryOptions = {}) {
        this.enabled = options.enabled ?? false;
        this.usePriorityResolver = options.usePriorityResolver ?? true;
        this.debug = options.debug ?? false;
        this.logger = options.logger || console;

        if (this.debug) {
            this.logger.debug('Plugin discovery options:', JSON.stringify(options, null, 2));
        }

        // Determine plugin directories
        const directories: string[] = [];

        if (options.systemPluginDirectory) {
            directories.push(options.systemPluginDirectory);
        }

        if (options.userPluginDirectory) {
            directories.push(options.userPluginDirectory);
        }

        if (options.additionalDirectories) {
            directories.push(...options.additionalDirectories);
        }

        // Create loader and resolver
        this.pluginLoader = new PluginLoader({
            directories,
            loadSystemPlugins: options.loadSystemPlugins ?? true,
            loadUserPlugins: options.loadUserPlugins ?? true,
            logger: this.logger
        });

        this.priorityResolver = new PriorityResolver({
            config: options.intentHandlerConfig,
            logger: this.logger
        });

        if (this.enabled) {
            this.logger.info('Plugin discovery system enabled');
            if (this.usePriorityResolver) {
                this.logger.info('Using priority-based intent resolver');
            } else {
                this.logger.info('Using simple first-match intent resolver');
            }
        } else {
            this.logger.info('Plugin discovery system disabled (passthrough mode)');
        }
    }

    /**
     * Initialize the plugin discovery system
     */
    async initialize(): Promise<void> {
        if (!this.enabled) {
            this.logger.debug('Plugin discovery system not enabled, skipping initialization');
            return;
        }

        try {
            // Load plugins
            const loadResults = await this.pluginLoader.loadPlugins();

            // Register with resolver
            this.priorityResolver.registerPlugins(loadResults);

            // Store loaded plugins
            for (const result of loadResults) {
                this.loadedPlugins.set(result.info.id, result.plugin);
            }

            this.logger.info(`Plugin discovery system initialized with ${loadResults.length} plugins`);
        } catch (error) {
            this.logger.error(`Failed to initialize plugin discovery system: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }

    /**
     * Find a plugin that can handle the given intent
     */
    findPluginForIntent(intent: Intent): IPlugin | undefined {
        if (!this.enabled) {
            return undefined;
        }

        if (!this.usePriorityResolver) {
            // Fall back to simple first-match strategy
            for (const plugin of this.loadedPlugins.values()) {
                if (plugin.supportedIntents().includes(intent.action)) {
                    return plugin;
                }
            }
            return undefined;
        }

        return this.priorityResolver.resolvePluginForIntent(intent);
    }

    /**
     * Get all loaded plugins
     */
    getAllPlugins(): Map<string, IPlugin> {
        return new Map(this.loadedPlugins);
    }

    /**
     * Get a plugin by ID
     */
    getPlugin(id: string): IPlugin | undefined {
        return this.loadedPlugins.get(id);
    }

    /**
     * Check if a plugin is substituted by another plugin
     */
    isPluginSubstituted(id: string): boolean {
        if (!this.enabled) {
            return false;
        }

        return this.priorityResolver.isPluginSubstituted(id);
    }

    /**
     * Get plugin that substitutes another plugin
     */
    getSubstitutingPlugin(id: string): IPlugin | undefined {
        if (!this.enabled) {
            return undefined;
        }

        return this.priorityResolver.getSubstitutingPlugin(id);
    }
}

// Export all interfaces and classes
export * from './manifest';
export * from './loader';
export * from './priorityResolver'; 