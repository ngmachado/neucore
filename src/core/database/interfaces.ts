/**
 * Database interfaces for the NeuroCore framework
 */

import { UUID, Entity as CoreEntity, Namespace as CoreNamespace, NamespaceMember as CoreNamespaceMember, Memory, Goal as CoreGoal, Relationship as CoreRelationship, Knowledge as CoreKnowledge, CacheEntry as CoreCacheEntry } from '../types';

export interface Entity extends CoreEntity {
    name?: string;
    type: string;
    content: string;
    metadata?: Record<string, any>;
}

export interface Namespace extends CoreNamespace { }

export interface NamespaceMember extends CoreNamespaceMember {
    role: string;
}

export interface MemoryEntity extends Entity {
    entityId?: UUID;
    namespaceId?: UUID;
    agentId?: UUID;
    isUnique: boolean;
    embedding?: number[];
}

export interface Goal extends Entity {
    entityId?: UUID;
    namespaceId?: UUID;
    name: string;
    status: string;
    description?: string;
    objectives: any[];
    userId: UUID;
}

export interface Relationship extends Entity {
    sourceId: UUID;
    targetId: UUID;
    type: string;
    metadata: Record<string, any>;
    userA?: UUID;
    userB?: UUID;
    status?: string;
}

export interface Knowledge extends Entity {
    type: string;
    metadata: Record<string, any>;
}

export interface CacheEntry {
    key: string;
    value: string;
    entityId: UUID;
    expiresAt?: Date;
    createdAt: Date;
}

export interface QueryOptions {
    where?: Record<string, any>;
    orderBy?: string;
    orderDirection?: 'ASC' | 'DESC';
    limit?: number;
    offset?: number;
    userId?: string;
    namespaceId?: string;
}

export interface VectorSearchOptions {
    query: string;
    limit?: number;
    threshold?: number;
}

export interface DatabaseStatus {
    connected: boolean;
    memoryCount: number;
    relationshipCount: number;
    goalCount: number;
}

export interface DatabaseAdapter {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    getStatus(): Promise<DatabaseStatus>;
    executeQuery<T>(query: string, params?: any[]): Promise<T[]>;

    // Memory operations
    createMemory(memory: Omit<MemoryEntity, 'id' | 'createdAt'>): Promise<MemoryEntity>;
    getMemory(id: UUID): Promise<MemoryEntity>;
    updateMemory(id: UUID, updates: Partial<MemoryEntity>): Promise<MemoryEntity>;
    deleteMemory(id: UUID): Promise<void>;
    listMemories(options?: QueryOptions): Promise<MemoryEntity[]>;
    searchByEmbedding(embedding: number[], options: VectorSearchOptions): Promise<MemoryEntity[]>;

    // Relationship operations
    createRelationship(relationship: Omit<Relationship, 'id' | 'createdAt'>): Promise<Relationship>;
    getRelationship(id: UUID): Promise<Relationship>;
    updateRelationship(id: UUID, updates: Partial<Relationship>): Promise<Relationship>;
    deleteRelationship(id: UUID): Promise<void>;
    getRelationships(entityId: UUID): Promise<Relationship[]>;

    // Goal operations
    createGoal(goal: Omit<Goal, 'id' | 'createdAt'>): Promise<Goal>;
    getGoal(id: UUID): Promise<Goal>;
    updateGoal(id: UUID, updates: Partial<Goal>): Promise<Goal>;
    deleteGoal(id: UUID): Promise<void>;
    deleteAllGoals(): Promise<void>;
    listGoals(options?: QueryOptions): Promise<Goal[]>;

    // Knowledge operations
    createKnowledge(knowledge: Omit<Knowledge, 'id' | 'createdAt'>): Promise<Knowledge>;
    getKnowledge(id: UUID): Promise<Knowledge>;
    updateKnowledge(id: UUID, updates: Partial<Knowledge>): Promise<Knowledge>;
    deleteKnowledge(id: UUID): Promise<void>;
    listKnowledge(options?: QueryOptions): Promise<Knowledge[]>;

    // Cache operations
    setCacheEntry(entry: Omit<CacheEntry, 'createdAt'>): Promise<CacheEntry>;
    getCacheEntry(key: string): Promise<CacheEntry | null>;
    deleteCacheEntry(key: string): Promise<void>;
    listCacheEntries(options?: QueryOptions): Promise<CacheEntry[]>;

    // Entity operations
    createEntity(entity: Omit<Entity, 'id' | 'createdAt'>): Promise<Entity>;
    getEntity(id: UUID): Promise<Entity | null>;
    updateEntity(id: UUID, updates: Partial<Entity>): Promise<Entity>;
    deleteEntity(id: UUID): Promise<void>;
    listEntities(options?: QueryOptions): Promise<Entity[]>;

    // Namespace operations
    createNamespace(namespace: Omit<Namespace, 'id' | 'createdAt'>): Promise<Namespace>;
    getNamespace(id: UUID): Promise<Namespace | null>;
    updateNamespace(id: UUID, updates: Partial<Namespace>): Promise<Namespace>;
    deleteNamespace(id: UUID): Promise<void>;
    listNamespaces(options?: QueryOptions): Promise<Namespace[]>;

    // Namespace member operations
    addNamespaceMember(member: Omit<NamespaceMember, 'id' | 'createdAt'>): Promise<NamespaceMember>;
    getNamespaceMember(id: UUID): Promise<NamespaceMember | null>;
    updateNamespaceMember(id: UUID, updates: Partial<NamespaceMember>): Promise<NamespaceMember>;
    removeNamespaceMember(id: UUID): Promise<void>;
    listNamespaceMembers(namespaceId: UUID, options?: QueryOptions): Promise<NamespaceMember[]>;
} 