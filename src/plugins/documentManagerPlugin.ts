import { IPlugin, PluginResult, RequestContext } from '../mcp/interfaces/plugin';
import { Intent } from '../mcp/intent';
import { VectorAdapter } from '../database/adapters/vector';
import { SQLiteAdapter } from '../database/adapters/sqlite';
import { DatabaseAdapter, MemoryEntity } from '../core/database/interfaces';
import { getLogger } from '../core/logging';
import { v4 as uuidv4 } from 'uuid';

const logger = getLogger('document-manager-plugin');

interface DocumentManagerPluginConfig {
    dbPath?: string;
}

/**
 * DocumentManagerPlugin handles document-related intents including
 * embedding, search, and retrieval operations
 */
export class DocumentManagerPlugin implements IPlugin {
    private initialized: boolean = false;
    private vectorAdapter: VectorAdapter | null = null;
    private dbAdapter: SQLiteAdapter | null = null;

    constructor(private config: DocumentManagerPluginConfig = {}) {
        // Don't initialize adapters in constructor to avoid throwing
        // We'll do it in the initialize method with proper error handling
    }

    public supportedIntents(): string[] {
        return [
            'document:embed',
            'document:search',
            'document:delete'
        ];
    }

    async initialize(): Promise<void> {
        if (this.initialized) {
            logger.warn('Document manager plugin already initialized');
            return;
        }

        try {
            logger.info('Initializing document manager plugin...');

            // Create SQLite adapter
            logger.debug('Creating SQLite adapter with path:', this.config.dbPath || './data/neurocore.db');
            this.dbAdapter = new SQLiteAdapter({
                path: this.config.dbPath || './data/neurocore.db'
            });

            // Connect to database
            logger.debug('Connecting to database...');
            await this.dbAdapter.connect();
            logger.info('Connected to database successfully');

            // Create vector adapter
            logger.debug('Creating vector adapter...');
            this.vectorAdapter = new VectorAdapter();

            // Initialize vector adapter
            logger.debug('Initializing vector adapter...');
            await this.vectorAdapter.initialize();
            logger.info('Vector adapter initialized successfully');

            this.initialized = true;
            logger.info('Document manager plugin initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize document manager plugin:', error);
            if (error instanceof Error) {
                logger.error('Error details:', {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                });
            }
            // Don't throw to avoid crashing the application
            // We'll just mark it as not initialized
            this.initialized = false;
        }
    }

    async shutdown(): Promise<void> {
        if (!this.initialized || !this.dbAdapter) return;

        try {
            await this.dbAdapter.disconnect();
            this.initialized = false;
            logger.info('Document manager plugin shut down');
        } catch (error) {
            logger.error('Failed to shut down document manager plugin:', error);
            // Still mark as not initialized even if shutdown fails
            this.initialized = false;
        }
    }

    async execute(intent: Intent, context: RequestContext): Promise<PluginResult> {
        if (!this.initialized) {
            logger.error('Document manager plugin not initialized, cannot execute intent:', intent.action);
            return {
                success: false,
                error: 'Document manager plugin not initialized'
            };
        }

        try {
            logger.debug(`Executing intent ${intent.action} with data:`, intent.data);

            switch (intent.action) {
                case 'document:embed':
                    return await this.handleDocumentEmbed(intent.data);
                case 'document:search':
                    return await this.handleDocumentSearch(intent.data);
                case 'document:delete':
                    return await this.handleDocumentDelete(intent.data);
                default:
                    logger.warn(`Unsupported intent action: ${intent.action}`);
                    throw new Error(`Unsupported intent action: ${intent.action}`);
            }
        } catch (error) {
            logger.error(`Failed to execute document intent ${intent.action}:`, error);
            if (error instanceof Error) {
                logger.error('Error details:', {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                });
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Handle document:embed intent
     * Embeds a document and stores it in the database
     */
    private async handleDocumentEmbed(data: any): Promise<PluginResult> {
        if (!this.vectorAdapter || !this.dbAdapter) {
            logger.error('Adapters not initialized, cannot embed document');
            return {
                success: false,
                error: 'Document manager plugin not properly initialized'
            };
        }

        const { content, metadata = {} } = data;

        if (!content || typeof content !== 'string') {
            logger.warn('Missing or invalid content for document:embed');
            return {
                success: false,
                error: 'Content is required and must be a string'
            };
        }

        try {
            logger.info(`Embedding document: ${metadata.title || metadata.source || 'unknown'}`);
            logger.info(`Content preview: "${content.substring(0, 50)}..."${content.length > 50 ? ' (truncated)' : ''}`);

            // Generate embedding vector
            logger.info('Calling OpenAI API to generate embedding...');
            const embedding = await this.vectorAdapter.generateEmbedding(content);
            logger.info(`Generated embedding with ${embedding.length} dimensions`);

            // Store in database
            logger.info('Storing document with embedding in database...');
            const memoryData = {
                type: metadata.type || 'document',
                content,
                metadata: {
                    ...metadata,
                    fragmentIndex: Date.now() // Use timestamp as a unique fragment index
                },
                name: metadata.source || 'unknown',
                isUnique: true,
                embedding
            };

            const result = await this.dbAdapter.createMemory(memoryData);
            logger.info(`Document embedded and stored in database with ID: ${result.id}`);

            return {
                success: true,
                data: {
                    message: 'Document embedded successfully',
                    documentId: result.id
                }
            };
        } catch (error) {
            logger.error('Error embedding document:', error);
            if (error instanceof Error) {
                logger.error('Error details:', {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                });
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Handle document:search intent
     * Searches for documents similar to the query
     */
    private async handleDocumentSearch(data: any): Promise<PluginResult> {
        if (!this.vectorAdapter || !this.dbAdapter) {
            logger.error('Adapters not initialized, cannot search documents');
            return {
                success: false,
                error: 'Document manager plugin not properly initialized'
            };
        }

        const { query, limit = 5, minScore = 0.7 } = data;

        if (!query || typeof query !== 'string') {
            logger.warn('Missing or invalid query for document:search');
            return {
                success: false,
                error: 'Query is required and must be a string'
            };
        }

        try {
            logger.debug(`Generating embedding for search query: "${query}"`);
            // Generate embedding for query
            const embedding = await this.vectorAdapter.generateEmbedding(query);

            logger.debug(`Searching for similar documents with threshold ${minScore} and limit ${limit}`);
            // Search for similar documents
            const searchResult = await this.dbAdapter.searchByEmbedding(embedding, {
                query,
                limit,
                threshold: minScore
            });

            logger.debug(`Found ${searchResult.length} matching documents`);

            // Map results to a more friendly format, with extra safeguards
            const results = searchResult.map(item => {
                // Log the raw item structure to help debug issues
                logger.debug('Processing search result item:',
                    JSON.stringify({
                        id: item?.id,
                        hasContent: !!item?.content,
                        hasMetadata: !!item?.metadata,
                        hasSimilarity: 'similarity' in (item as any)
                    })
                );

                // The actual similarity value might be stored in a different way
                // in different implementations - we'll handle that here
                const similarity = 'similarity' in (item as any) ?
                    (item as any).similarity : 0.7; // Default if not found

                if (!item || !item.id) {
                    logger.warn('Received invalid search result item without ID');
                    return null;
                }

                return {
                    document: {
                        id: item.id,
                        content: item.content || '',
                        title: (item.metadata?.title || item.name || 'Untitled Document'),
                        type: (item.metadata?.type || item.type || 'document')
                    },
                    score: similarity
                };
            }).filter(Boolean); // Filter out null entries

            return {
                success: true,
                data: { results }
            };
        } catch (error) {
            logger.error('Error searching documents:', error);
            if (error instanceof Error) {
                logger.error('Error details:', {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                });
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Handle document:delete intent
     * Deletes a document from the database
     */
    private async handleDocumentDelete(data: any): Promise<PluginResult> {
        if (!this.dbAdapter) {
            logger.error('DB adapter not initialized, cannot delete document');
            return {
                success: false,
                error: 'Document manager plugin not properly initialized'
            };
        }

        const { id } = data;

        if (!id) {
            logger.warn('Missing document ID for document:delete');
            return {
                success: false,
                error: 'Document ID is required'
            };
        }

        try {
            logger.debug(`Deleting document with ID: ${id}`);
            await this.dbAdapter.deleteMemory(id);

            logger.info(`Document deleted successfully: ${id}`);
            return {
                success: true,
                data: { message: 'Document deleted successfully' }
            };
        } catch (error) {
            logger.error(`Error deleting document ${id}:`, error);
            if (error instanceof Error) {
                logger.error('Error details:', {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                });
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    getPluginDirectory(): string {
        return __dirname;
    }
} 