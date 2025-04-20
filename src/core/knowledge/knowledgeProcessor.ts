import { DocumentConfig, PluginDocumentConfig } from '../types';
import { MCP } from '../../mcp/mcp';
import { DocumentManager } from '../document/documentManager';
import { getLogger } from '../logging';
import { join } from 'path';

const logger = getLogger('knowledge-processor');

export class KnowledgeProcessor {
    private processedDocs = new Set<string>();
    private documentManager: DocumentManager;

    constructor(private mcp: MCP, private basePath: string = process.cwd()) {
        this.documentManager = new DocumentManager(mcp, basePath);
    }

    async processPluginKnowledge(plugin: any): Promise<void> {
        if (!plugin.documentConfig) return;

        logger.info(`Processing knowledge for plugin: ${plugin.name}`);
        await this.documentManager.processPluginDocuments(plugin.documentConfig);
    }

    async processDirectoryKnowledge(dirPath: string, config: Partial<DocumentConfig> = {}): Promise<void> {
        const fullPath = join(this.basePath, dirPath);
        logger.info(`Processing knowledge from directory: ${fullPath}`);

        const defaultConfig: PluginDocumentConfig = {
            documents: [{
                path: dirPath,
                type: 'text',
                fragmentSize: 1000,
                fragmentOverlap: 200,
                metadata: {
                    source: 'directory',
                    type: 'directory'
                }
            }]
        };

        await this.documentManager.processPluginDocuments(defaultConfig);
    }

    async processStringKnowledge(content: string, metadata: Record<string, any> = {}): Promise<void> {
        logger.info(`Processing string knowledge (${content.length} chars) with metadata: ${JSON.stringify(metadata)}`);

        const config: PluginDocumentConfig = {
            documents: [{
                path: 'string-content',
                type: 'text',
                content,
                fragmentSize: 1000,
                fragmentOverlap: 200,
                metadata: {
                    source: 'string',
                    type: metadata.type || 'text',
                    ...metadata
                }
            }]
        };

        try {
            await this.documentManager.processPluginDocuments(config);
            logger.info('String knowledge processed successfully');
        } catch (error) {
            logger.error(`Error processing string knowledge: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
} 