/**
 * Message Content Protocol (MCP) Implementation
 */

import { IPlugin } from './interfaces/plugin';
import { Intent } from './intent';
import { PluginManager } from './pluginManager';
import { ProviderManager } from './providerManager';
import { generateUUID } from '../utils';

/**
 * Configuration for MCP
 */
interface MCPConfig {
    // Configuration options
}

/**
 * Message Control Protocol
 * Central orchestrator for intent handling
 */
export class MCP {
    private pluginManager: PluginManager;
    private providerManager: ProviderManager;
    private config: MCPConfig;

    constructor(config: MCPConfig = {}) {
        this.config = config;
        this.pluginManager = new PluginManager();
        this.providerManager = new ProviderManager();
    }

    /**
     * Initialize MCP
     */
    public async initialize(): Promise<void> {
        // Initialize components
        await this.providerManager.initialize();
    }

    /**
     * Shutdown MCP
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
     * Execute an intent
     * @param intent Intent to execute
     */
    public async executeIntent(intent: Intent): Promise<any> {
        const plugin = this.pluginManager.findPluginForIntent(intent);
        if (!plugin) {
            throw new Error(`No plugin found for intent: ${intent.action}`);
        }
        return plugin.execute(intent, { requestId: generateUUID(), userId: 'system', mcp: this });
    }
} 