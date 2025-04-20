import { FAQEntry, FAQSearchOptions, FAQSearchResult, FAQRelationship } from './types';
import { SQLiteAdapter } from '../../adapters/sqlite';
import { VectorAdapter } from '../../adapters/vector';
import { UUID } from '../../../types';
import { getLogger } from '../../../core/logging';
import crypto from 'crypto';

const logger = getLogger('FAQStorage');

export class FAQStorage {
    private sqliteAdapter: SQLiteAdapter;
    private vectorAdapter: VectorAdapter;

    constructor(sqliteAdapter: SQLiteAdapter, vectorAdapter: VectorAdapter) {
        this.sqliteAdapter = sqliteAdapter;
        this.vectorAdapter = vectorAdapter;
    }

    async initialize(): Promise<void> {
        await this.sqliteAdapter.connect();
        await this.vectorAdapter.initialize();
    }

    async createEntry(entry: Omit<FAQEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<FAQEntry> {
        const id = crypto.randomUUID();
        const now = new Date();

        const faqEntry: FAQEntry = {
            ...entry,
            id,
            createdAt: now,
            updatedAt: now
        };

        // Store in SQLite
        const memory = await this.sqliteAdapter.createMemory({
            type: 'faq',
            content: JSON.stringify({
                question: faqEntry.question,
                answer: faqEntry.answer
            }),
            metadata: {
                category: faqEntry.category,
                subcategory: faqEntry.subcategory,
                tags: faqEntry.tags,
                ...faqEntry.metadata
            },
            isUnique: false
        });

        // Generate and store embedding
        const embedding = await this.vectorAdapter.generateEmbedding(
            `${entry.question} ${entry.answer}`
        );

        // TODO: Store embedding in SQLite

        return faqEntry;
    }

    async getEntry(id: UUID): Promise<FAQEntry | null> {
        const memory = await this.sqliteAdapter.getMemory(id);
        if (!memory) return null;

        const content = JSON.parse(memory.content);
        const metadata = memory.metadata || {};

        return {
            id: memory.id,
            question: content.question,
            answer: content.answer,
            category: metadata.category,
            subcategory: metadata.subcategory,
            tags: metadata.tags || [],
            metadata: metadata,
            createdAt: memory.createdAt,
            updatedAt: memory.createdAt // Using createdAt as fallback
        };
    }

    async searchEntries(options: FAQSearchOptions): Promise<FAQSearchResult[]> {
        if (options.query) {
            // Use vector search for semantic queries
            // First generate embedding for the query
            const embedding = await this.vectorAdapter.generateEmbedding(options.query);

            // Then search using the embedding with correct interface
            const vectorResults = await this.sqliteAdapter.searchByEmbedding(embedding, {
                query: options.query,
                limit: options.limit,
                threshold: 0.7
            });

            // Need to handle the lack of similarity score in MemoryEntity
            return vectorResults.map(result => {
                const content = JSON.parse(result.content);
                return {
                    entry: {
                        id: result.id,
                        question: content.question,
                        answer: content.answer,
                        category: result.metadata?.category,
                        subcategory: result.metadata?.subcategory,
                        tags: result.metadata?.tags || [],
                        metadata: result.metadata || {},
                        createdAt: result.createdAt,
                        updatedAt: result.createdAt
                    },
                    relevance: 0.8 // Estimated relevance since we don't have actual score
                };
            });
        } else {
            // Use SQLite for structured queries
            const query = `
                SELECT * FROM memories 
                WHERE type = 'faq'
                ${options.category ? "AND json_extract(metadata, '$.category') = ?" : ''}
                ${options.subcategory ? "AND json_extract(metadata, '$.subcategory') = ?" : ''}
                ${options.tags ? "AND json_extract(metadata, '$.tags') IS NOT NULL" : ''}
                LIMIT ? OFFSET ?
            `;

            const params = [
                ...(options.category ? [options.category] : []),
                ...(options.subcategory ? [options.subcategory] : []),
                options.limit || 10,
                options.offset || 0
            ];

            const memories = await this.sqliteAdapter.executeQuery(query, params);
            return memories.map((memory: any) => {
                const content = JSON.parse(memory.content);
                return {
                    entry: {
                        id: memory.id,
                        question: content.question,
                        answer: content.answer,
                        category: memory.metadata?.category,
                        subcategory: memory.metadata?.subcategory,
                        tags: memory.metadata?.tags || [],
                        metadata: memory.metadata || {},
                        createdAt: new Date(memory.created_at),
                        updatedAt: new Date(memory.created_at)
                    },
                    relevance: 1.0 // Perfect match for direct queries
                };
            });
        }
    }

    async createRelationship(relationship: Omit<FAQRelationship, 'id' | 'createdAt'>): Promise<FAQRelationship> {
        const id = crypto.randomUUID();
        const now = new Date();

        const faqRelationship: FAQRelationship = {
            ...relationship,
            id,
            createdAt: now
        };

        // TODO: Store relationship in SQLite

        return faqRelationship;
    }

    async getRelationships(entryId: UUID): Promise<FAQRelationship[]> {
        // TODO: Implement relationship retrieval
        return [];
    }
} 