import { DocumentConfig, PluginDocumentConfig, ContextItem } from '../types';
import { IContextProvider } from '../interfaces/context';
import { MCP } from '../../mcp/mcp';
import { Intent } from '../../mcp/intent';
import { DocumentLoader } from './documentLoader';
import { join } from 'path';

export class DocumentManager {
    private processedDocs = new Set<string>();
    private documentLoader: DocumentLoader;

    constructor(private mcp: MCP, private basePath: string) {
        this.documentLoader = new DocumentLoader(basePath);
    }

    async processPluginDocuments(config: PluginDocumentConfig): Promise<void> {
        for (const doc of config.documents) {
            if (this.processedDocs.has(doc.path)) continue;

            const content = await this.documentLoader.loadDocument(doc);
            const fragments = this.createFragments(content, doc);

            for (const fragment of fragments) {
                await this.saveFragment(fragment, {
                    ...doc.metadata,
                    source: doc.path,
                    type: doc.type
                });
            }

            this.processedDocs.add(doc.path);
        }
    }

    private containsPartialUrl(text: string): boolean {
        // Common URL patterns that shouldn't be split
        const urlPatterns = [
            /https?:\/\/[^\s]+/,  // Full URLs
            /www\.[^\s]+/,        // www domains
            /[^\s]+\.(com|org|net|io|ai|dev)[^\s]*/,  // Common TLDs
            /[^\s]+\.(co|uk|de|fr|jp)[^\s]*/,         // Country TLDs
            /[^\s]+\.(app|dev|test|local)[^\s]*/,     // Development TLDs
            /[^\s]+:\/\/[^\s]+/,  // Protocol-based URLs
            /[^\s]+@[^\s]+/,      // Email addresses
            /[^\s]+#[^\s]+/,      // Anchors
            /[^\s]+\/[^\s]+/,     // Path segments
        ];

        return urlPatterns.some(pattern => pattern.test(text));
    }

    private createFragments(content: string, config: DocumentConfig): string[] {
        const size = config.fragmentSize || 1000;
        const overlap = config.fragmentOverlap || 200;
        const fragments: string[] = [];

        // First try splitting by paragraphs
        const paragraphs = content.split(/\n\s*\n/);
        if (paragraphs.length > 1 && paragraphs.every(p => p.length <= size * 1.5)) {
            let currentChunk = '';

            for (const paragraph of paragraphs) {
                if (!paragraph.trim()) continue;

                // Check if adding this paragraph would split a URL
                const wouldSplitUrl = this.containsPartialUrl(currentChunk) ||
                    this.containsPartialUrl(paragraph);

                // If adding this paragraph exceeds chunk size and we already have content
                if (currentChunk && currentChunk.length + paragraph.length + 2 > size) {
                    // If we would split a URL, try to keep it together
                    if (wouldSplitUrl && currentChunk.length + paragraph.length <= size * 1.5) {
                        currentChunk += '\n\n' + paragraph;
                        continue;
                    }

                    fragments.push(currentChunk);

                    // Calculate overlap
                    if (overlap > 0 && currentChunk.length > overlap) {
                        const overlapStart = currentChunk.length - Math.min(overlap, currentChunk.length);
                        currentChunk = currentChunk.substring(overlapStart);
                    } else {
                        currentChunk = '';
                    }
                }

                // Add paragraph with proper spacing
                currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
            }

            // Add final chunk if not empty
            if (currentChunk) {
                fragments.push(currentChunk);
            }

            return fragments;
        }

        // If paragraphs are too large, use sentence-based splitting
        let currentChunk = '';
        const sentences = content.match(/[^.!?]+(?:[.!?](?:["']|\s|$))+/g) || [content];

        for (const sentence of sentences) {
            const trimmedSentence = sentence.trim();
            if (!trimmedSentence) continue;

            // Check if adding this sentence would split a URL
            const wouldSplitUrl = this.containsPartialUrl(currentChunk) ||
                this.containsPartialUrl(trimmedSentence);

            // Check if adding this sentence would exceed chunk size
            if (currentChunk && currentChunk.length + trimmedSentence.length + 1 > size) {
                // If we would split a URL, try to keep it together
                if (wouldSplitUrl && currentChunk.length + trimmedSentence.length <= size * 1.5) {
                    currentChunk += ' ' + trimmedSentence;
                    continue;
                }

                fragments.push(currentChunk);

                // Calculate overlap
                if (overlap > 0 && currentChunk.length > overlap) {
                    const overlapStart = currentChunk.length - Math.min(overlap, currentChunk.length);
                    currentChunk = currentChunk.substring(overlapStart);
                } else {
                    currentChunk = '';
                }
            }

            // Add sentence with proper spacing
            currentChunk += (currentChunk ? ' ' : '') + trimmedSentence;
        }

        // Add final chunk if not empty
        if (currentChunk) {
            fragments.push(currentChunk);
        }

        return fragments;
    }

    private async saveFragment(content: string, metadata?: Record<string, any>): Promise<void> {
        const intent = new Intent('document:embed', {
            content,
            metadata
        });
        await this.mcp.executeIntent(intent);
    }
} 