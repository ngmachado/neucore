import { IPlugin, PluginResult, RequestContext } from '../mcp/interfaces/plugin';
import { Intent } from '../mcp/intent';
import { UUID } from '../types';

/**
 * Simple context plugin to handle context-related intents
 */
export class ContextPlugin implements IPlugin {
    private initialized: boolean = false;
    private logger: any;

    constructor(options: { logger: any }) {
        this.logger = options.logger;
    }

    /**
     * Get the ID of this plugin
     */
    public getId(): UUID {
        return 'context-plugin';
    }

    /**
     * Get the name of this plugin
     */
    public getName(): string {
        return 'Context Plugin';
    }

    /**
     * Check if this plugin can handle an intent
     */
    public canHandle(intent: Intent): boolean {
        return intent.action.startsWith('context:');
    }

    /**
     * Get the list of intents this plugin supports
     */
    public supportedIntents(): string[] {
        return [
            'context:build',
            'context:retrieve',
            'context:process'
        ];
    }

    /**
     * Initialize the plugin
     */
    public async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        this.logger.info('Initializing ContextPlugin');
        this.initialized = true;
    }

    /**
     * Shutdown the plugin
     */
    public async shutdown(): Promise<void> {
        this.logger.info('Shutting down ContextPlugin');
        this.initialized = false;
    }

    /**
     * Execute an intent
     */
    public async execute(intent: Intent, context: RequestContext): Promise<PluginResult> {
        if (!this.initialized) {
            return {
                success: false,
                error: 'Plugin not initialized'
            };
        }

        try {
            switch (intent.action) {
                case 'context:build':
                    return this.handleBuildContext(intent.data, context);
                case 'context:retrieve':
                    return this.handleRetrieveContext(intent.data, context);
                case 'context:process':
                    return this.handleProcessContext(intent.data, context);
                default:
                    return {
                        success: false,
                        error: `Unsupported intent: ${intent.action}`
                    };
            }
        } catch (error) {
            this.logger.error(`Error executing intent ${intent.action}:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Handle building context
     */
    private async handleBuildContext(data: any, context: RequestContext): Promise<PluginResult> {
        const { query, options } = data || {};
        console.log(`[CONTEXT] Building context for query: "${query?.substring(0, 50)}..."`);

        if (!query) {
            console.log(`[CONTEXT] Error: Query is required for building context`);
            return {
                success: false,
                error: 'Query is required for building context'
            };
        }

        console.log(`[CONTEXT] Context build options: ${JSON.stringify(options || {})}`);
        const maxItems = options?.maxItems || 10;
        const includeTypes = options?.includeTypes || ['message', 'document', 'memory'];

        console.log(`[CONTEXT] Max items: ${maxItems}, Include types: ${includeTypes.join(', ')}`);

        try {
            // Mock context building
            const contextStartTime = Date.now();

            // Simulate semantic similarity search
            console.log(`[CONTEXT] Performing semantic search for query`);

            const contextItems = [
                { id: '1', type: 'message', content: { text: 'This is a relevant message about ' + query } },
                { id: '2', type: 'document', content: { text: 'Document containing information about ' + query } },
                { id: '3', type: 'memory', content: { text: 'A memory related to ' + query } }
            ];

            // Filter by specified types if needed
            const filteredItems = contextItems.filter(item => includeTypes.includes(item.type));
            console.log(`[CONTEXT] Filtered items by type, found ${filteredItems.length} items`);

            // Simulate relevance ranking
            const rankedItems = [...filteredItems].sort(() => Math.random() - 0.5);
            console.log(`[CONTEXT] Ranked items by relevance`);

            // Limit to max items
            const limitedItems = rankedItems.slice(0, maxItems);
            console.log(`[CONTEXT] Limited to ${limitedItems.length} items of ${rankedItems.length} total`);

            const contextBuildTime = Date.now() - contextStartTime;
            console.log(`[CONTEXT] Context built in ${contextBuildTime}ms`);

            // Log some details about the items
            const itemTypes: Record<string, number> = {};
            limitedItems.forEach(item => {
                itemTypes[item.type] = (itemTypes[item.type] || 0) + 1;
            });
            console.log(`[CONTEXT] Item type distribution: ${JSON.stringify(itemTypes)}`);

            return {
                success: true,
                data: {
                    contextItems: limitedItems,
                    count: limitedItems.length,
                    query,
                    metadata: {
                        buildTime: `${contextBuildTime}ms`,
                        types: itemTypes
                    }
                }
            };
        } catch (error) {
            console.log(`[CONTEXT] Error building context: ${error instanceof Error ? error.message : String(error)}`);
            this.logger.error(`Error building context: ${error instanceof Error ? error.message : String(error)}`);
            return {
                success: false,
                error: `Failed to build context: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Handle retrieving context
     */
    private async handleRetrieveContext(data: any, context: RequestContext): Promise<PluginResult> {
        const { contextId, options } = data || {};

        if (!contextId) {
            return {
                success: false,
                error: 'Context ID is required for retrieval'
            };
        }

        // Mock context retrieval
        const retrievedContext = {
            id: contextId,
            items: [
                { id: '1', type: 'message', content: { text: 'This is a context item' } },
                { id: '2', type: 'document', content: { text: 'Another context item' } }
            ],
            metadata: {
                createdAt: new Date().toISOString(),
                source: 'memory-store'
            }
        };

        return {
            success: true,
            data: {
                context: retrievedContext
            }
        };
    }

    /**
     * Handle processing context
     */
    private async handleProcessContext(data: any, context: RequestContext): Promise<PluginResult> {
        const { contextItems, options } = data || {};

        if (!contextItems || !Array.isArray(contextItems)) {
            return {
                success: false,
                error: 'Context items array is required for processing'
            };
        }

        // Mock context processing
        const processedItems = contextItems.map(item => ({
            ...item,
            processed: true,
            relevance: Math.random() * 0.5 + 0.5, // Random relevance between 0.5 and 1.0
            processed_at: new Date().toISOString()
        }));

        return {
            success: true,
            data: {
                processedItems,
                contextComplete: true
            }
        };
    }
} 