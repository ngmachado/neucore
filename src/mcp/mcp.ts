/**
 * Message Content Protocol (MCP) Implementation
 */

import { UUID } from '../types';
import { Intent } from './intent';
import { IPlugin } from './interfaces/plugin';
import { IntentManager } from './intentManager';
import { PluginManager } from './pluginManager';
import { ProviderManager } from './providerManager';
import { generateUUID } from '../utils';

/**
 * MCP configuration
 */
export interface MCPConfig {
    maxConcurrentIntents?: number;
    intentTimeout?: number;
    defaultPlugin?: IPlugin;
}

/**
 * MCP class for managing intents, plugins, and providers
 */
export class MCP {
    private intentManager: IntentManager;
    private pluginManager: PluginManager;
    private providerManager: ProviderManager;
    private config: MCPConfig;

    constructor(config: MCPConfig = {}) {
        this.config = {
            maxConcurrentIntents: 10,
            intentTimeout: 30000,
            ...config
        };
        this.intentManager = new IntentManager();
        this.pluginManager = new PluginManager();
        this.providerManager = new ProviderManager();
    }

    /**
     * Initialize MCP
     */
    public async initialize(): Promise<void> {
        await this.pluginManager.initialize();
        await this.providerManager.initialize();
    }

    /**
     * Register a plugin
     */
    public registerPlugin(plugin: IPlugin): void {
        this.pluginManager.registerPlugin(plugin);
    }

    /**
     * Unregister a plugin
     */
    public unregisterPlugin(pluginId: UUID): void {
        this.pluginManager.unregisterPlugin(pluginId);
    }

    /**
     * Register an intent
     */
    public registerIntent(intent: Intent): UUID {
        return this.intentManager.registerIntent(intent);
    }

    /**
     * Execute an intent
     */
    public async executeIntent(intent: Intent): Promise<any> {
        const plugin = this.pluginManager.getPluginForIntent(intent);
        if (!plugin) {
            throw new Error(`No plugin found for intent: ${intent.action}`);
        }
        return plugin.execute(intent, { requestId: generateUUID(), userId: 'system' });
    }

    /**
     * Shutdown MCP
     */
    public async shutdown(): Promise<void> {
        await this.pluginManager.shutdown();
        await this.providerManager.shutdown();
    }
} 