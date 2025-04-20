/**
 * Message Content Protocol (MCP) Implementation
 */

import { IPlugin } from './interfaces/plugin';
import { Intent } from './intent';
import { PluginManager } from './pluginManager';
import { ProviderManager } from './providerManager';
import { MCPConfig } from '../core/config/interfaces';
import { KnowledgeProcessor } from '../core/knowledge/knowledgeProcessor';
import { getLogger } from '../core/logging';
import { generateUUID } from '../core/utils';
import { DocumentProcessor } from '../core/document/documentProcessor';
import { VectorAdapter } from '../database/adapters/vector';
import { SQLiteAdapter } from '../database/adapters/sqlite';
import { DatabaseAdapter } from '../core/database/interfaces';
import { PluginDocumentConfig } from '../core/types';

const logger = getLogger('mcp');

/**
 * Configuration for MCP
 */
interface MCPOptions {
    // Configuration options
}

/**
 * Message Control Protocol
 * Central orchestrator for intent handling
 */
export class MCP {
    private pluginManager: PluginManager;
    private providerManager: ProviderManager;
    private knowledgeProcessor: KnowledgeProcessor;
    private config: MCPConfig;

    constructor(config: MCPConfig = {}) {
        this.config = config;
        this.pluginManager = new PluginManager();
        this.providerManager = new ProviderManager();
        this.knowledgeProcessor = new KnowledgeProcessor(this, process.cwd());
    }

    /**
     * Initialize MCP
     */
    public async initialize(): Promise<void> {
        logger.info('Initializing MCP...');

        // Initialize components
        await this.providerManager.initialize();

        // Process knowledge for all plugins
        const plugins = this.pluginManager.getPlugins();
        for (const plugin of plugins) {
            await this.knowledgeProcessor.processPluginKnowledge(plugin);
        }

        // Process any configured knowledge directories
        if (this.config.knowledge?.directories) {
            for (const dir of this.config.knowledge.directories) {
                await this.knowledgeProcessor.processDirectoryKnowledge(dir);
            }
        }

        logger.info('MCP initialized successfully');
    }

    /**
     * Shutdown MCP
     */
    public async shutdown(): Promise<void> {
        logger.info('Shutting down MCP...');
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

    /**
     * Get the knowledge processor instance
     * @returns The knowledge processor instance
     */
    public getKnowledgeProcessor(): KnowledgeProcessor {
        return this.knowledgeProcessor;
    }

    private async initializePlugin(plugin: IPlugin): Promise<void> {
        await plugin.initialize();

        if (this.knowledgeProcessor) {
            await this.knowledgeProcessor.processPluginKnowledge(plugin);
        }

        // Process plugin documents if configured
        if ('documentConfig' in plugin && plugin.documentConfig) {
            try {
                // Initialize database and vector adapters if not already done
                const dbAdapter = new SQLiteAdapter({ path: './data/neurocore.db' });
                await dbAdapter.connect();

                const vectorAdapter = new VectorAdapter();
                await vectorAdapter.initialize();

                // Create document processor
                const documentProcessor = new DocumentProcessor(
                    dbAdapter as unknown as DatabaseAdapter,
                    vectorAdapter,
                    process.cwd()
                );

                // Process plugin documents
                await documentProcessor.processPluginDocuments(
                    plugin.documentConfig as unknown as PluginDocumentConfig,
                    'plugin-' + generateUUID().slice(0, 8)
                );

                console.log(`Processed documents for plugin`);
            } catch (error) {
                console.error('Error processing plugin documents:', error);
            }
        }
    }
} 