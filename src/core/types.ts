export interface ContextItem {
    id: string;
    type: string;
    content: string;
    metadata?: Record<string, any>;
}

export interface DocumentConfig {
    path: string;
    type: 'json' | 'text' | 'markdown';
    content?: string;
    fragmentSize?: number;
    fragmentOverlap?: number;
    metadata?: Record<string, any>;
}

export interface PluginDocumentConfig {
    documents: DocumentConfig[];
    alwaysInclude?: boolean;
}

export type UUID = string;

export interface FAQEntry {
    id: string;
    question: string;
    answer: string;
    category?: string;
    subcategory?: string;
    tags?: string[];
    userId?: string;
    roomId?: string;
    agentId?: string;
}

export interface FAQSearchOptions {
    query: string;
    limit?: number;
    threshold?: number;
}

export interface FAQSearchResult {
    entry: FAQEntry;
    relevance: number;
}

export interface FAQRelationship {
    id: string;
    sourceId: string;
    targetId: string;
    type: string;
    metadata?: Record<string, any>;
    createdAt: Date;
}

export interface Entity {
    id: UUID;
    type: string;
    content: string;
    metadata?: Record<string, any>;
    createdAt: Date;
}

export interface Namespace {
    id: UUID;
    name: string;
    description?: string;
    metadata?: Record<string, any>;
    createdAt: Date;
}

export interface NamespaceMember {
    id: UUID;
    namespaceId: UUID;
    entityId: UUID;
    metadata?: Record<string, any>;
    createdAt: Date;
}

export interface Memory extends Entity {
    type: 'memory';
    userId?: string;
    roomId?: string;
    agentId?: string;
}

export interface Goal extends Entity {
    type: 'goal';
    status: 'active' | 'completed' | 'failed';
    priority: number;
}

export interface Relationship extends Entity {
    type: 'relationship';
    sourceId: UUID;
    targetId: UUID;
    relationshipType: string;
}

export interface Knowledge extends Entity {
    type: 'knowledge';
    source?: string;
    confidence?: number;
}

export interface CacheEntry {
    id: UUID;
    key: string;
    value: string;
    metadata?: Record<string, any>;
    expiresAt?: Date;
    createdAt: Date;
} 