import { IPlugin, PluginResult, RequestContext } from '../mcp/interfaces/plugin';
import { Intent } from '../mcp/intent';
import { UUID } from '../types';
import { MCP } from '../mcp/mcp';
import { getLogger } from '../core/logging';

enum LogLevel {
    TRACE = 0,
    DEBUG = 1,
    INFO = 2,
    WARN = 3,
    ERROR = 4,
    FATAL = 5
}

interface ContextItem {
    id: string;
    type: string;
    content: {
        text: string;
        title?: string;
        [key: string]: any;
    };
    metadata?: Record<string, any>;
}

const logger = getLogger('context-plugin');

/**
 * Simple context plugin to handle context-related intents
 */
export class ContextPlugin implements IPlugin {
    private initialized: boolean = false;
    private logger: any;
    private mcp: MCP;

    constructor(options: { logger: any; mcp: MCP }) {
        this.logger = options.logger;
        this.mcp = options.mcp;
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
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(`Error executing intent ${intent.action}: ${errorMessage}`);
            return {
                success: false,
                error: errorMessage
            };
        }
    }

    /**
     * Handle building context
     */
    private async handleBuildContext(data: any, context: RequestContext): Promise<PluginResult> {
        const { query, options } = data || {};
        this.logger.log(LogLevel.INFO, `Building context for query: "${query?.substring(0, 50)}..."`);

        if (!query) {
            this.logger.log(LogLevel.ERROR, `Query is required for building context`);
            return {
                success: false,
                error: 'Query is required for building context'
            };
        }

        this.logger.log(LogLevel.INFO, `Context build options: ${JSON.stringify(options || {})}`);
        const maxItems = options?.maxItems || 10;
        const includeTypes = options?.includeTypes || ['message', 'document', 'memory'];
        const minScore = options?.minScore || 0.3;

        this.logger.log(LogLevel.INFO, `Max items: ${maxItems}, Include types: ${includeTypes.join(', ')}, Min score: ${minScore}`);

        try {
            // Start context building - using real document search
            const contextStartTime = Date.now();

            // Use document search intent to find relevant documents
            this.logger.log(LogLevel.INFO, `Performing semantic search for query: "${query.substring(0, 100)}..."`);
            const searchResult = await this.mcp.executeIntent(new Intent({
                action: 'document:search',
                data: {
                    query,
                    limit: maxItems,
                    minScore
                }
            }));

            if (!searchResult.success) {
                throw new Error(`Document search failed: ${searchResult.error}`);
            }

            // Get results from document search
            const results = searchResult.data?.results || [];
            this.logger.log(LogLevel.INFO, `Found ${results.length} matching documents with min score ${minScore}`);

            // Log each result for debugging
            if (results.length > 0) {
                results.forEach((result: any, index: number) => {
                    this.logger.log(LogLevel.DEBUG, `Result #${index + 1}: Score ${result.score}, Title: ${result.document.title}`);
                    this.logger.log(LogLevel.DEBUG, `Content preview: ${result.document.content.substring(0, 100)}...`);
                });
            } else {
                this.logger.log(LogLevel.WARN, `No context results found, continuing with reasoning without context`);
            }

            // Transform results to context items
            const contextItems = results.map((result: any) => ({
                id: result.document.id,
                type: result.document.type || 'document',
                content: {
                    text: result.document.content,
                    title: result.document.title
                },
                metadata: {
                    score: result.score,
                    type: result.document.type || 'document'
                }
            }));

            const contextBuildTime = Date.now() - contextStartTime;
            this.logger.log(LogLevel.INFO, `Context built in ${contextBuildTime}ms`);

            // Log some details about the items
            const itemTypes: Record<string, number> = {};
            contextItems.forEach((item: ContextItem) => {
                itemTypes[item.type] = (itemTypes[item.type] || 0) + 1;
            });
            this.logger.log(LogLevel.INFO, `Item type distribution: ${JSON.stringify(itemTypes)}`);

            return {
                success: true,
                data: {
                    contextItems,
                    count: contextItems.length,
                    query,
                    metadata: {
                        buildTime: `${contextBuildTime}ms`,
                        types: itemTypes
                    }
                }
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.log(LogLevel.ERROR, `Error building context: ${errorMessage}`);
            return {
                success: false,
                error: `Failed to build context: ${errorMessage}`
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

        try {
            // Use MCP to retrieve context from memory storage
            const memoryIntent = {
                action: 'memory:retrieve',
                data: {
                    id: contextId,
                    options: {
                        includeMetadata: true,
                        ...options
                    }
                }
            };

            const result = await this.mcp.executeIntent(memoryIntent, context);

            if (!result.success) {
                return {
                    success: false,
                    error: `Failed to retrieve context: ${result.error || 'Unknown error'}`
                };
            }

            const retrievedContext = {
                id: contextId,
                items: result.data.items || [],
                metadata: result.data.metadata || {
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
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(`Error retrieving context: ${errorMessage}`);
            return {
                success: false,
                error: `Error retrieving context: ${errorMessage}`
            };
        }
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

        try {
            // Process each context item
            const processedItems = await Promise.all(contextItems.map(async (item) => {
                // Calculate relevance using the reasoning plugin
                const reasoningIntent = {
                    action: 'reasoning:analyze',
                    data: {
                        content: item.content.text,
                        options: {
                            methodOptions: {
                                analysisType: 'relevance'
                            }
                        }
                    }
                };

                // Try to get relevance score using reasoning
                let relevance = 0.5; // Default relevance
                try {
                    const reasoningResult = await this.mcp.executeIntent(reasoningIntent, context);
                    if (reasoningResult.success && reasoningResult.data.conclusion) {
                        // Extract numerical relevance from conclusion if possible
                        const match = reasoningResult.data.conclusion.match(/(\d+(\.\d+)?)/);
                        if (match) {
                            const score = parseFloat(match[0]);
                            // Normalize to 0-1 range if needed
                            relevance = score > 1 ? score / 10 : score;
                        }
                    }
                } catch (reasoningError) {
                    const errorMessage = reasoningError instanceof Error ? reasoningError.message : String(reasoningError);
                    this.logger.warn(`Failed to calculate relevance: ${errorMessage}`);
                }

                return {
                    ...item,
                    processed: true,
                    relevance,
                    processed_at: new Date().toISOString()
                };
            }));

            // Sort by relevance
            processedItems.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));

            return {
                success: true,
                data: {
                    processedItems,
                    contextComplete: true
                }
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(`Error processing context: ${errorMessage}`);
            return {
                success: false,
                error: `Error processing context: ${errorMessage}`
            };
        }
    }
} 