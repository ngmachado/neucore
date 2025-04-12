/**
 * Plugin Manager for MCP
 */

import { UUID } from '../types';
import { IPlugin } from './interfaces/plugin';
import { generateUUID } from '../utils';

/**
 * Plugin manager configuration
 */
export interface PluginManagerConfig {
    maxPlugins?: number;
    pluginTimeout?: number;
}

/**
 * Plugin manager class
 */
export class PluginManager {
    private plugins: Map<UUID, IPlugin>;
    private config: PluginManagerConfig;

    constructor(config: PluginManagerConfig = {}) {
        this.plugins = new Map();
        this.config = {
            maxPlugins: 100,
            pluginTimeout: 30000,
            ...config
        };
    }

    /**
     * Initialize plugin manager
     */
    public async initialize(): Promise<void> {
        // Initialize all registered plugins
        for (const plugin of this.plugins.values()) {
            if (plugin.initialize) {
                await plugin.initialize();
            }
        }
    }

    /**
     * Register a plugin
     */
    public registerPlugin(plugin: IPlugin): UUID {
        const id = generateUUID();
        this.plugins.set(id, plugin);
        return id;
    }

    /**
     * Unregister a plugin
     */
    public unregisterPlugin(pluginId: UUID): boolean {
        const plugin = this.plugins.get(pluginId);
        if (plugin && plugin.shutdown) {
            plugin.shutdown();
        }
        return this.plugins.delete(pluginId);
    }

    /**
     * Get plugin for an intent
     */
    public getPluginForIntent(intent: { action: string }): IPlugin | undefined {
        for (const plugin of this.plugins.values()) {
            if (plugin.supportedIntents().includes(intent.action)) {
                return plugin;
            }
        }
        return undefined;
    }

    /**
     * Get all registered plugins
     */
    public getAllPlugins(): IPlugin[] {
        return Array.from(this.plugins.values());
    }

    /**
     * Shutdown plugin manager
     */
    public async shutdown(): Promise<void> {
        for (const plugin of this.plugins.values()) {
            if (plugin.shutdown) {
                await plugin.shutdown();
            }
        }
        this.plugins.clear();
    }
} 