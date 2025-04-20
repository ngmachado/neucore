import { IContextProvider } from '../interfaces/context';
import { ContextItem } from '../types';
import { Intent } from '../../mcp/intent';
import { MCP } from '../../mcp/mcp';

export class DocumentContextProvider implements IContextProvider {
    constructor(private mcp: MCP) { }

    async getContext(query: string, options: any = {}): Promise<ContextItem[]> {
        const { limit = 5, minScore = 0.7 } = options;

        // Search for relevant documents
        const searchIntent = new Intent('document:search', {
            query,
            limit
        });

        const searchResult = await this.mcp.executeIntent(searchIntent);
        if (!searchResult.success) {
            return [];
        }

        // Convert search results to context items
        return searchResult.data.results
            .filter((result: any) => result.score >= minScore)
            .map((result: any) => {
                const doc = result.document;
                return {
                    id: doc.id,
                    type: 'document',
                    content: doc.content,
                    metadata: {
                        title: doc.title,
                        type: doc.type,
                        score: result.score
                    }
                };
            });
    }

    async addContext(item: ContextItem): Promise<void> {
        // Documents are added through the document manager plugin
        throw new Error('Use document:embed intent to add documents');
    }

    async removeContext(id: string): Promise<void> {
        // Documents are removed through the document manager plugin
        throw new Error('Use document manager plugin to remove documents');
    }
} 