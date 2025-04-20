import { Database, RunResult } from 'sqlite3';

export interface SQLiteOperations {
    get<T = any>(sql: string, params?: any[]): Promise<T | undefined>;
    run(sql: string, params?: any[]): Promise<RunResult>;
    all<T = any>(sql: string, params?: any[]): Promise<T[]>;
    prepare(sql: string): Promise<{
        get<T = any>(...params: any[]): Promise<T | undefined>;
        run(...params: any[]): Promise<RunResult>;
        all<T = any>(...params: any[]): Promise<T[]>;
        finalize(): Promise<void>;
    }>;
}

export interface SQLiteDatabase extends Database {
    operations: SQLiteOperations;
    transaction<T>(fn: () => T): T;
}

export interface MemoryRow {
    id: string;
    type: string;
    content: string;
    metadata: string;
    name?: string;
    entityId?: string;
    namespaceId?: string;
    agentId?: string;
    unique: number;
    embedding?: Buffer;
    createdAt: number;
}

export interface EntityRow {
    id: string;
    type: string;
    content: string;
    metadata: string;
    name?: string;
    created_at: string;
}

export interface NamespaceRow {
    id: string;
    name: string;
    description?: string;
    metadata: string;
    createdAt: number;
}

export interface NamespaceMemberRow {
    id: string;
    namespaceId: string;
    entityId: string;
    role: string;
    metadata: string;
    createdAt: number;
}

export interface GoalRow {
    id: string;
    type: string;
    content: string;
    metadata: string;
    name: string;
    status: string;
    description?: string;
    objectives: string;
    userId: string;
    entityId?: string;
    namespaceId?: string;
    createdAt: number;
}

export interface RelationshipRow {
    id: string;
    type: string;
    content: string;
    metadata: string;
    sourceId: string;
    targetId: string;
    userA?: string;
    userB?: string;
    status?: string;
    createdAt: number;
}

export interface KnowledgeRow {
    id: string;
    type: string;
    content: string;
    metadata: string;
    source?: string;
    confidence?: number;
    createdAt: number;
}

export interface CacheEntryRow {
    id: string;
    key: string;
    value: string;
    entityId: string;
    metadata: string;
    expiresAt?: number;
    createdAt: number;
} 