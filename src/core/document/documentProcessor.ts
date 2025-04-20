import { DocumentConfig, PluginDocumentConfig } from '../types';
import { DatabaseAdapter, MemoryEntity } from '../database/interfaces';
import { VectorAdapter } from '../../database/adapters/vector';
import { getLogger } from '../logging';
import { readFileSync } from 'fs';
import { join } from 'path';
import { UUID } from '../types';

const logger = getLogger('DocumentProcessor');

/**
 * DocumentProcessor handles processing and embedding documents from plugins
 * so they can be used as context for AI agents
 */
export class DocumentProcessor {
    constructor(
        private databaseAdapter: DatabaseAdapter,
        private vectorAdapter: VectorAdapter,
        private basePath: string
    ) { }

    /**
     * Process documents from a plugin
     * @param config Plugin document configuration
     * @param pluginId ID of the plugin
     */
    async processPluginDocuments(config: PluginDocumentConfig, pluginId: string): Promise<void> {
        logger.info(`Processing ${config.documents.length} documents from plugin ${pluginId}`);

        for (const doc of config.documents) {
            try {
                const content = await this.loadDocument(doc);
                const fragments = this.splitIntoFragments(content, doc);

                logger.info(`Split document ${doc.path} into ${fragments.length} fragments`);

                for (const fragment of fragments) {
                    await this.storeFragment(fragment, doc, pluginId);
                }

                logger.info(`Successfully processed document ${doc.path}`);
            } catch (error) {
                logger.error(`Error processing document ${doc.path}:`, error);
            }
        }
    }

    /**
     * Load document content from file or use provided content
     * @param doc Document configuration
     * @returns Document content as string
     */
    private async loadDocument(doc: DocumentConfig): Promise<string> {
        if (doc.content) {
            return doc.content;
        }

        const filePath = join(this.basePath, doc.path);
        return readFileSync(filePath, 'utf-8');
    }

    /**
     * Split document content into fragments
     * @param content Document content
     * @param config Document configuration
     * @returns Array of text fragments
     */
    private splitIntoFragments(content: string, config: DocumentConfig): string[] {
        const fragmentSize = config.fragmentSize || 1000;
        const fragmentOverlap = config.fragmentOverlap || 200;

        if (content.length <= fragmentSize) {
            return [content];
        }

        const fragments: string[] = [];
        let startPos = 0;

        while (startPos < content.length) {
            const endPos = Math.min(startPos + fragmentSize, content.length);
            fragments.push(content.substring(startPos, endPos));
            startPos = endPos - fragmentOverlap;

            // Break if we've reached the end
            if (startPos + fragmentSize >= content.length) {
                // Add the last fragment if we haven't reached the end
                if (endPos < content.length) {
                    fragments.push(content.substring(startPos));
                }
                break;
            }
        }

        return fragments;
    }

    /**
     * Store a document fragment in the database with embedding
     * @param fragment Text fragment
     * @param doc Document configuration
     * @param pluginId ID of the plugin
     */
    private async storeFragment(fragment: string, doc: DocumentConfig, pluginId: string): Promise<void> {
        try {
            // Generate embedding
            const embedding = await this.vectorAdapter.generateEmbedding(fragment);

            // Store in database as a memory entity
            await this.databaseAdapter.createMemory({
                type: doc.type || 'document',
                content: fragment,
                metadata: {
                    ...doc.metadata,
                    source: doc.path,
                    pluginId,
                    fragmentIndex: Date.now() // Use timestamp as a unique fragment index
                },
                name: doc.path,
                isUnique: true,
                embedding
            });

            logger.debug(`Stored fragment with embedding (${embedding.length} dimensions)`);
        } catch (error) {
            logger.error('Error storing document fragment:', error);
        }
    }
} 