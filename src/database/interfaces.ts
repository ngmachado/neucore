import { UUID } from '../types';

export interface DatabaseConfig {
    path: string;
    options?: {
        memory?: boolean;
        readonly?: boolean;
        fileMustExist?: boolean;
        timeout?: number;
        verbose?: boolean;
    };
}

export interface QueryOptions {
    where?: Record<string, any>;
    orderBy?: string;
    orderDirection?: 'ASC' | 'DESC';
    limit?: number;
    offset?: number;
}

export interface DatabaseAdapter {
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    query(query: string, params?: any[]): Promise<any[]>;
    execute(query: string, params?: any[]): Promise<void>;
    transaction(operations: Array<{ query: string; params?: any[] }>): Promise<void>;
    getStatus(): Promise<Record<string, any>>;
}

export interface Entity {
    id: UUID;
    createdAt: Date;
    name: string;
    username?: string;
    email?: string;
    avatarUrl?: string;
    details?: Record<string, any>;
}

export interface Memory {
    id: UUID;
    type: string;
    createdAt: Date;
    content: string;
    embedding?: number[];
    userId?: UUID;
    namespaceId?: UUID;
    agentId?: UUID;
}

export interface Goal {
    id: UUID;
    createdAt: Date;
    userId: UUID;
    name: string;
    status: string;
    description?: string;
    namespaceId?: UUID;
    objectives?: string[];
}

export interface Namespace {
    id: UUID;
    createdAt: Date;
}

export interface NamespaceMember {
    id: UUID;
    createdAt: Date;
    userId: UUID;
    namespaceId: UUID;
    userState: string;
}

export interface Relationship {
    id: UUID;
    createdAt: Date;
    userA: UUID;
    userB: UUID;
    status: string;
}

export interface Knowledge {
    id: UUID;
    agentId: UUID;
    content: string;
    embedding?: number[];
    createdAt: Date;
    isMain: boolean;
    originalId?: UUID;
    chunkIndex?: number;
    isShared: boolean;
}

export interface CacheEntry {
    key: string;
    value: string;
    expiresAt?: Date;
    createdAt: Date;
} 