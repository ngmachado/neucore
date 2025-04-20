import { UUID } from '../../../types';

export interface FAQEntry {
    id: UUID;
    question: string;
    answer: string;
    category?: string;
    subcategory?: string;
    tags?: string[];
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

export interface FAQSearchOptions {
    query?: string;
    category?: string;
    subcategory?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
}

export interface FAQRelationship {
    id: UUID;
    sourceId: UUID;
    targetId: UUID;
    type: 'related' | 'prerequisite' | 'see-also';
    metadata?: Record<string, any>;
    createdAt: Date;
}

export interface FAQSearchResult {
    entry: FAQEntry;
    relevance: number;
    relationships?: FAQRelationship[];
} 