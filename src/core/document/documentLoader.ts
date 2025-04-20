import { DocumentConfig } from '../types';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { getLogger } from '../logging';

const logger = getLogger('document-loader');

export class DocumentLoader {
    constructor(private basePath: string) { }

    async loadDocument(doc: DocumentConfig): Promise<string> {
        // If content is already provided, use it directly
        if (doc.content) {
            logger.debug(`Using provided content for document: ${doc.path}`);
            return doc.content;
        }

        const filePath = join(this.basePath, doc.path);
        logger.debug(`Loading document from file: ${filePath}`);

        switch (doc.type) {
            case 'json':
                return this.loadJson(filePath);
            case 'text':
                return this.loadText(filePath);
            case 'markdown':
                return this.loadMarkdown(filePath);
            default:
                throw new Error(`Unsupported document type: ${doc.type}`);
        }
    }

    private async loadJson(filePath: string): Promise<string> {
        const content = await readFile(filePath, 'utf-8');
        const json = JSON.parse(content);
        return JSON.stringify(json, null, 2);
    }

    private async loadText(filePath: string): Promise<string> {
        return readFile(filePath, 'utf-8');
    }

    private async loadMarkdown(filePath: string): Promise<string> {
        return readFile(filePath, 'utf-8');
    }
} 