import { Intent } from '../../mcp/intent';
import { FAQStorage } from '../knowledge/faq/storage';
import { FAQEntry, FAQSearchOptions, FAQSearchResult } from '../knowledge/faq/types';
import { getLogger } from '../../core/logging';

const logger = getLogger('KnowledgeBaseIntent');

export class KnowledgeBaseIntent extends Intent {
    private faqStorage: FAQStorage;

    constructor(faqStorage: FAQStorage) {
        super('knowledge-base');
        this.faqStorage = faqStorage;
    }

    async execute(params: any): Promise<any> {
        const { action, data } = params;

        switch (action) {
            case 'search':
                return this.handleSearch(data);
            case 'create':
                return this.handleCreate(data);
            case 'get':
                return this.handleGet(data);
            default:
                throw new Error(`Unknown action: ${action}`);
        }
    }

    private async handleSearch(options: FAQSearchOptions): Promise<FAQSearchResult[]> {
        logger.debug('Searching knowledge base:', options);
        return this.faqStorage.searchEntries(options);
    }

    private async handleCreate(entry: Omit<FAQEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<FAQEntry> {
        logger.debug('Creating knowledge base entry:', entry);
        return this.faqStorage.createEntry(entry);
    }

    private async handleGet(id: string): Promise<FAQEntry | null> {
        logger.debug('Getting knowledge base entry:', id);
        return this.faqStorage.getEntry(id);
    }
} 