import { DatabaseAdapter, QueryOptions, VectorSearchOptions, DatabaseStatus, Entity, Namespace, NamespaceMember, MemoryEntity, Relationship, Goal, Knowledge, CacheEntry } from '../../../core/database/interfaces';
import { UUID } from '../../../core/types';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { randomUUID } from 'crypto';
import { GoalStatus } from '../../../types/goals';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { getLogger } from '../../../core/logging';

const logger = getLogger('sqlite-adapter');

// Helper function to type database rows more safely
function asRow<T>(row: unknown): T {
    return row as unknown as T;
}

// Define interfaces for database table rows
interface EntityRow {
    id: string;
    type: string;
    content: string;
    name?: string;
    metadata?: string;
    created_at: string;
}

interface NamespaceRow {
    id: string;
    name: string;
    description?: string;
    metadata?: string;
    created_at: string;
}

interface NamespaceMemberRow {
    id: string;
    namespace_id: string;
    entity_id: string;
    role: string;
    metadata?: string;
    created_at: string;
}

interface MemoryRow {
    id: string;
    type: string;
    content: string;
    name?: string;
    entity_id?: string;
    namespace_id?: string;
    agent_id?: string;
    is_unique?: number;
    embedding?: Buffer;
    metadata?: string;
    created_at: string;
}

interface RelationshipRow {
    id: string;
    type: string;
    content: string;
    source_id: string;
    target_id: string;
    metadata?: string;
    user_a?: string;
    user_b?: string;
    status?: string;
    created_at: string;
}

interface GoalRow {
    id: string;
    type: string;
    content: string;
    name: string;
    entity_id?: string;
    namespace_id?: string;
    status: string;
    description?: string;
    objectives: string;
    user_id: string;
    metadata?: string;
    created_at: string;
}

interface KnowledgeRow {
    id: string;
    type: string;
    content: string;
    metadata: string;
    created_at: string;
}

interface CacheEntryRow {
    key: string;
    value: string;
    entity_id: string;
    expires_at?: string;
    created_at: string;
}

export class SQLiteAdapter implements DatabaseAdapter {
    private db: Database.Database | null = null;
    private isConnected = false;

    constructor(private config: { path: string }) { }

    async connect(): Promise<void> {
        try {
            logger.info(`Connecting to SQLite database at ${this.config.path}`);

            // Ensure directory exists
            const dir = dirname(this.config.path);
            if (!existsSync(dir)) {
                logger.debug(`Creating directory ${dir} for SQLite database`);
                mkdirSync(dir, { recursive: true });
            }

            // Check if better-sqlite3 is properly installed
            try {
                logger.debug('Loading better-sqlite3 module');
                const betterSqlite3Path = require.resolve('better-sqlite3');
                logger.debug(`Found better-sqlite3 at ${betterSqlite3Path}`);

                const nodePath = join(dirname(betterSqlite3Path), 'build', 'Release', 'better_sqlite3.node');
                if (!existsSync(nodePath)) {
                    logger.warn(`Native module not found at ${nodePath}`);
                }
            } catch (err) {
                logger.error('Failed to load better-sqlite3 module:', err);
                throw new Error(`Failed to load better-sqlite3 module: ${err}`);
            }

            // Initialize database
            logger.debug(`Opening SQLite database connection at ${this.config.path}`);
            this.db = new Database(this.config.path);

            // Initialize tables
            logger.debug('Initializing database tables');
            await this.initializeTables();

            this.isConnected = true;
            logger.info('Successfully connected to SQLite database');
        } catch (error) {
            logger.error('Failed to connect to SQLite database:', error);
            if (error instanceof Error) {
                logger.error('Error details:', {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                });
            }
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        if (this.db) {
            try {
                this.db.close();
                this.db = null;
                this.isConnected = false;
                logger.info('Disconnected from SQLite database');
            } catch (error) {
                logger.error('Error disconnecting from SQLite database:', error);
                throw error;
            }
        }
    }

    private async initializeTables(): Promise<void> {
        if (!this.db) throw new Error('Database not connected');
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS entities (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                content TEXT NOT NULL,
                metadata TEXT,
                name TEXT,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS namespaces (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                metadata TEXT,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS namespace_members (
                id TEXT PRIMARY KEY,
                namespace_id TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                role TEXT NOT NULL,
                metadata TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (namespace_id) REFERENCES namespaces(id),
                FOREIGN KEY (entity_id) REFERENCES entities(id)
            );
            CREATE TABLE IF NOT EXISTS memories (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                content TEXT NOT NULL,
                metadata TEXT,
                name TEXT,
                entity_id TEXT,
                namespace_id TEXT,
                agent_id TEXT,
                is_unique INTEGER NOT NULL DEFAULT 0,
                embedding BLOB,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS relationships (
                id TEXT PRIMARY KEY,
                source_id TEXT NOT NULL,
                target_id TEXT NOT NULL,
                type TEXT NOT NULL,
                content TEXT NOT NULL,
                metadata TEXT,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS goals (
                id TEXT PRIMARY KEY,
                entity_id TEXT,
                namespace_id TEXT,
                name TEXT NOT NULL,
                status TEXT NOT NULL,
                description TEXT,
                objectives TEXT,
                user_id TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS knowledge (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                content TEXT NOT NULL,
                metadata TEXT,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS cache (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                expires_at TEXT,
                created_at TEXT NOT NULL
            )
        `);
    }

    async getStatus(): Promise<DatabaseStatus> {
        if (!this.db) throw new Error('Database not connected');
        const memoryCount = this.db.prepare('SELECT COUNT(*) as count FROM memories').get() as { count: number };
        const relationshipCount = this.db.prepare('SELECT COUNT(*) as count FROM relationships').get() as { count: number };
        const goalCount = this.db.prepare('SELECT COUNT(*) as count FROM goals').get() as { count: number };
        return {
            connected: this.isConnected,
            memoryCount: memoryCount?.count || 0,
            relationshipCount: relationshipCount?.count || 0,
            goalCount: goalCount?.count || 0
        };
    }

    async executeQuery<T>(query: string, params: any[] = []): Promise<T[]> {
        if (!this.db) throw new Error('Database not connected');
        const result = this.db.prepare(query).all(...params) as unknown as T[];
        return result;
    }

    async executeRun(query: string, params: any[] = []): Promise<void> {
        if (!this.db) throw new Error('Database not connected');
        this.db.prepare(query).run(...params);
    }

    async createEntity(data: Omit<Entity, 'id' | 'createdAt'>): Promise<Entity> {
        if (!this.db) throw new Error('Database not connected');
        const id = uuidv4();
        const now = new Date();
        const metadata = data.metadata ? JSON.stringify(data.metadata) : null;

        this.db.prepare(
            `INSERT INTO entities (id, type, content, metadata, name, created_at) 
             VALUES (?, ?, ?, ?, ?, ?)`
        ).run(id, data.type, data.content, metadata, data.name, now.toISOString());

        return {
            id,
            type: data.type,
            content: data.content,
            name: data.name,
            metadata: data.metadata,
            createdAt: now
        };
    }

    async getEntity(id: UUID): Promise<Entity | null> {
        if (!this.db) throw new Error('Database not connected');

        const row = this.db
            .prepare('SELECT * FROM entities WHERE id = ?')
            .get(id) as {
                id: string;
                type: string;
                content: string;
                name: string;
                metadata: string;
                created_at: string;
            } | undefined;

        if (!row) return null;

        return {
            id: row.id,
            type: row.type,
            content: row.content,
            name: row.name,
            metadata: row.metadata ? JSON.parse(row.metadata) : {},
            createdAt: new Date(row.created_at)
        };
    }

    async updateEntity(id: UUID, updates: Partial<Entity>): Promise<Entity> {
        if (!this.db) throw new Error('Database not connected');

        const entity = await this.getEntity(id);
        if (!entity) throw new Error(`Entity not found with id: ${id}`);

        const metadata = updates.metadata ? JSON.stringify(updates.metadata) : undefined;

        const updateValues: string[] = [];
        const params: any[] = [];

        if (updates.type !== undefined) {
            updateValues.push('type = ?');
            params.push(updates.type);
        }

        if (updates.content !== undefined) {
            updateValues.push('content = ?');
            params.push(updates.content);
        }

        if (updates.name !== undefined) {
            updateValues.push('name = ?');
            params.push(updates.name);
        }

        if (updates.metadata !== undefined) {
            updateValues.push('metadata = ?');
            params.push(metadata);
        }

        if (updateValues.length === 0) {
            return entity;
        }

        params.push(id);

        this.db.prepare(
            `UPDATE entities SET ${updateValues.join(', ')} WHERE id = ?`
        ).run(...params);

        return this.getEntity(id) as Promise<Entity>;
    }

    async deleteEntity(id: UUID): Promise<void> {
        if (!this.db) throw new Error('Database not connected');
        this.db.prepare('DELETE FROM entities WHERE id = ?').run(id);
    }

    async listEntities(query?: { type?: string; namespaceId?: UUID }): Promise<Entity[]> {
        if (!this.db) throw new Error('Database not connected');
        let sql = 'SELECT * FROM entities';
        const params: string[] = [];

        if (query?.type) {
            sql += ' WHERE type = ?';
            params.push(query.type);
        }

        if (query?.namespaceId) {
            sql += query?.type ? ' AND' : ' WHERE';
            sql += ' namespace_id = ?';
            params.push(query.namespaceId);
        }

        const rows = this.db.prepare(sql).all(...params) as unknown as EntityRow[];

        return rows.map(row => ({
            id: row.id,
            type: row.type,
            content: row.content,
            name: row.name,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
            createdAt: new Date(row.created_at)
        }));
    }

    async addNamespaceMember(member: Omit<NamespaceMember, 'id' | 'createdAt'>): Promise<NamespaceMember> {
        if (!this.db) throw new Error('Database not connected');

        const newMember: NamespaceMember = {
            id: uuidv4(),
            namespaceId: member.namespaceId,
            entityId: member.entityId,
            role: member.role,
            metadata: member.metadata,
            createdAt: new Date()
        };

        this.db.prepare(
            'INSERT INTO namespace_members (id, namespace_id, entity_id, role, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(
            newMember.id,
            newMember.namespaceId,
            newMember.entityId,
            newMember.role,
            newMember.metadata ? JSON.stringify(newMember.metadata) : null,
            newMember.createdAt.toISOString()
        );

        return newMember;
    }

    async getNamespaceMember(id: UUID): Promise<NamespaceMember | null> {
        if (!this.db) throw new Error('Database not connected');

        const row = this.db
            .prepare('SELECT * FROM namespace_members WHERE id = ?')
            .get(id) as {
                id: string;
                namespace_id: string;
                entity_id: string;
                role: string;
                metadata: string;
                created_at: string;
            } | undefined;

        if (!row) return null;

        return {
            id: row.id,
            namespaceId: row.namespace_id,
            entityId: row.entity_id,
            role: row.role,
            metadata: row.metadata ? JSON.parse(row.metadata) : {},
            createdAt: new Date(row.created_at)
        };
    }

    async updateNamespaceMember(id: UUID, updates: Partial<NamespaceMember>): Promise<NamespaceMember> {
        if (!this.db) throw new Error('Database not connected');

        const member = await this.getNamespaceMember(id);
        if (!member) throw new Error(`NamespaceMember not found with id: ${id}`);

        const metadata = updates.metadata ? JSON.stringify(updates.metadata) : undefined;

        this.db.prepare(
            `UPDATE namespace_members 
             SET namespace_id = ?, entity_id = ?, role = ?, metadata = ?
             WHERE id = ?`
        ).run(
            updates.namespaceId ?? member.namespaceId,
            updates.entityId ?? member.entityId,
            updates.role ?? member.role,
            metadata ?? member.metadata ? JSON.stringify(member.metadata) : null,
            id
        );

        return this.getNamespaceMember(id) as Promise<NamespaceMember>;
    }

    async deleteNamespaceMember(id: UUID): Promise<void> {
        if (!this.db) throw new Error('Database not connected');
        this.db.prepare('DELETE FROM namespace_members WHERE id = ?').run(id);
    }

    async listNamespaceMembers(namespaceId: UUID, options?: QueryOptions): Promise<NamespaceMember[]> {
        if (!this.db) throw new Error('Database not connected');
        let sql = 'SELECT * FROM namespace_members WHERE namespace_id = ?';
        const params: any[] = [namespaceId];

        if (options?.where) {
            const conditions = Object.entries(options.where)
                .map(([key, value]) => `${key} = ?`)
                .join(' AND ');
            sql += ` AND ${conditions}`;
            params.push(...Object.values(options.where));
        }

        if (options?.orderBy) {
            sql += ` ORDER BY ${options.orderBy} ${options.orderDirection || 'ASC'}`;
        }

        if (options?.limit) {
            sql += ' LIMIT ?';
            params.push(options.limit);
        }

        if (options?.offset) {
            sql += ' OFFSET ?';
            params.push(options.offset);
        }

        const rows = this.db.prepare(sql).all(...params) as unknown as NamespaceMemberRow[];
        return rows.map(row => ({
            id: row.id,
            namespaceId: row.namespace_id,
            entityId: row.entity_id,
            role: row.role,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
            createdAt: new Date(row.created_at)
        }));
    }

    /**
     * Create a new memory
     * @param memory Memory data to store
     * @returns Created memory data with ID
     */
    async createMemory(memory: Partial<MemoryEntity>): Promise<MemoryEntity> {
        if (!this.db) throw new Error('Database not connected');

        console.log(`Creating memory: ${memory.name || 'unnamed'}`);

        // Check if embedding is present
        if (memory.embedding) {
            console.log(`Memory has embedding of dimension ${memory.embedding.length}`);
        } else {
            console.log('Warning: Memory created without embedding');
        }

        // Generate a UUID for the memory
        const id = uuidv4();

        // Get the current timestamp
        const timestamp = new Date().toISOString();

        // Prepare the memory data
        const memoryData: any = {
            id,
            ...memory,
            createdAt: timestamp
        };

        // Insert the memory into the database
        try {
            this.db.prepare(
                `INSERT INTO memories 
                (id, type, content, metadata, name, entity_id, namespace_id, agent_id, is_unique, embedding, created_at, updated_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).run(
                id,
                memory.type || 'unknown',
                memory.content || '',
                memory.metadata ? JSON.stringify(memory.metadata) : null,
                memory.name || 'unnamed',
                memory.entityId || null,
                memory.namespaceId || null,
                memory.agentId || null,
                memory.isUnique ? 1 : 0,
                memory.embedding ? Buffer.from(Float64Array.from(memory.embedding).buffer) : null,
                timestamp,
                timestamp  // Added updated_at value
            );

            console.log(`Memory created with ID: ${id}`);
        } catch (error) {
            console.error('Error storing memory in database:', error);
            throw error;
        }

        // Return the created memory
        return memoryData;
    }

    async getMemory(id: UUID): Promise<MemoryEntity> {
        if (!this.db) throw new Error('Database not connected');
        const row = this.db.prepare('SELECT * FROM memories WHERE id = ?').get(id) as unknown as MemoryRow;

        if (!row) throw new Error(`Memory not found: ${id}`);

        return {
            id: row.id,
            type: row.type,
            content: row.content,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
            name: row.name,
            entityId: row.entity_id,
            namespaceId: row.namespace_id,
            agentId: row.agent_id,
            isUnique: Boolean(row.is_unique),
            embedding: row.embedding ? Array.from(row.embedding) : undefined,
            createdAt: new Date(row.created_at)
        };
    }

    async updateMemory(id: UUID, updates: Partial<Omit<MemoryEntity, 'id' | 'createdAt'>>): Promise<MemoryEntity> {
        if (!this.db) throw new Error('Database not connected');

        const updateValues: string[] = [];
        const params: any[] = [];

        if (updates.type !== undefined) {
            updateValues.push('type = ?');
            params.push(updates.type);
        }

        if (updates.content !== undefined) {
            updateValues.push('content = ?');
            params.push(updates.content);
        }

        if (updates.metadata !== undefined) {
            updateValues.push('metadata = ?');
            params.push(JSON.stringify(updates.metadata));
        }

        if (updates.name !== undefined) {
            updateValues.push('name = ?');
            params.push(updates.name);
        }

        if (updates.entityId !== undefined) {
            updateValues.push('entity_id = ?');
            params.push(updates.entityId);
        }

        if (updates.namespaceId !== undefined) {
            updateValues.push('namespace_id = ?');
            params.push(updates.namespaceId);
        }

        if (updates.agentId !== undefined) {
            updateValues.push('agent_id = ?');
            params.push(updates.agentId);
        }

        if (updates.isUnique !== undefined) {
            updateValues.push('is_unique = ?');
            params.push(updates.isUnique ? 1 : 0);
        }

        if (updates.embedding !== undefined) {
            updateValues.push('embedding = ?');
            params.push(updates.embedding ? Buffer.from(updates.embedding) : null);
        }

        if (updateValues.length === 0) {
            return this.getMemory(id);
        }

        params.push(id);

        this.db.prepare(`UPDATE memories SET ${updateValues.join(', ')} WHERE id = ?`).run(...params);

        return this.getMemory(id);
    }

    async deleteMemory(id: UUID): Promise<void> {
        if (!this.db) throw new Error('Database not connected');

        const stmt = this.db.prepare('DELETE FROM memories WHERE id = ?');
        const result = stmt.run(id);

        if (result.changes === 0) {
            throw new Error(`Memory with id ${id} not found`);
        }
    }

    async listMemories(options?: QueryOptions): Promise<MemoryEntity[]> {
        if (!this.db) throw new Error('Database not connected');
        let sql = 'SELECT * FROM memories';
        const params: any[] = [];

        if (options?.where) {
            const conditions = Object.entries(options.where)
                .map(([key, value]) => `${key} = ?`)
                .join(' AND ');
            sql += ` WHERE ${conditions}`;
            params.push(...Object.values(options.where));
        }

        if (options?.orderBy) {
            sql += ` ORDER BY ${options.orderBy} ${options.orderDirection || 'ASC'}`;
        }

        if (options?.limit) {
            sql += ' LIMIT ?';
            params.push(options.limit);
        }

        if (options?.offset) {
            sql += ' OFFSET ?';
            params.push(options.offset);
        }

        const rows = this.db.prepare(sql).all(...params) as unknown as MemoryRow[];
        return rows.map(row => ({
            id: row.id,
            type: row.type,
            content: row.content,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
            name: row.name,
            entityId: row.entity_id,
            namespaceId: row.namespace_id,
            agentId: row.agent_id,
            isUnique: Boolean(row.is_unique),
            embedding: row.embedding ? Array.from(row.embedding) : undefined,
            createdAt: new Date(row.created_at)
        }));
    }

    async searchMemories(query: string, options?: VectorSearchOptions): Promise<MemoryEntity[]> {
        // TODO: Implement vector search
        return [];
    }

    async createGoal(data: Omit<Goal, 'id' | 'createdAt'>): Promise<Goal> {
        if (!this.db) throw new Error('Database not connected');

        const id = randomUUID();
        const createdAt = new Date();
        const status = data.status || GoalStatus.PENDING;

        const newGoal: Goal = {
            id,
            type: data.type,
            content: data.content,
            metadata: data.metadata,
            entityId: data.entityId,
            namespaceId: data.namespaceId,
            name: data.name,
            status,
            description: data.description,
            objectives: data.objectives,
            userId: data.userId,
            createdAt
        };

        this.db.prepare(
            'INSERT INTO goals (id, entity_id, namespace_id, name, status, description, objectives, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(
            newGoal.id,
            newGoal.entityId,
            newGoal.namespaceId,
            newGoal.name,
            newGoal.status,
            newGoal.description,
            JSON.stringify(newGoal.objectives),
            newGoal.userId,
            newGoal.createdAt.toISOString()
        );

        return newGoal;
    }

    async getGoal(id: UUID): Promise<Goal> {
        if (!this.db) throw new Error('Database not connected');
        const row = this.db.prepare('SELECT * FROM goals WHERE id = ?').get(id) as unknown as GoalRow;

        if (!row) throw new Error(`Goal not found: ${id}`);

        return {
            id: row.id,
            type: row.type,
            content: row.content,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
            entityId: row.entity_id,
            namespaceId: row.namespace_id,
            name: row.name,
            status: row.status,
            description: row.description,
            objectives: JSON.parse(row.objectives),
            userId: row.user_id,
            createdAt: new Date(row.created_at)
        };
    }

    async updateGoal(id: UUID, updates: Partial<Goal>): Promise<Goal> {
        if (!this.db) throw new Error('Database not connected');
        const goal = await this.getGoal(id);

        const metadata = updates.metadata ? JSON.stringify(updates.metadata) : undefined;
        const objectives = updates.objectives ? JSON.stringify(updates.objectives) : undefined;

        this.db.prepare(
            `UPDATE goals 
             SET entity_id = ?, namespace_id = ?, name = ?, status = ?, description = ?, objectives = ?, user_id = ?
             WHERE id = ?`
        ).run(
            updates.entityId ?? goal.entityId,
            updates.namespaceId ?? goal.namespaceId,
            updates.name ?? goal.name,
            updates.status ?? goal.status,
            updates.description ?? goal.description,
            objectives ?? JSON.stringify(goal.objectives),
            updates.userId ?? goal.userId,
            id
        );

        return this.getGoal(id);
    }

    async deleteGoal(id: UUID): Promise<void> {
        if (!this.db) throw new Error('Database not connected');
        this.db.prepare('DELETE FROM goals WHERE id = ?').run(id);
    }

    async listGoals(options?: QueryOptions): Promise<Goal[]> {
        if (!this.db) throw new Error('Database not connected');
        let sql = 'SELECT * FROM goals';
        const params: any[] = [];

        if (options?.where) {
            const conditions = Object.entries(options.where)
                .map(([key, value]) => `${key} = ?`)
                .join(' AND ');
            sql += ` WHERE ${conditions}`;
            params.push(...Object.values(options.where));
        }

        if (options?.orderBy) {
            sql += ` ORDER BY ${options.orderBy} ${options.orderDirection || 'ASC'}`;
        }

        if (options?.limit) {
            sql += ' LIMIT ?';
            params.push(options.limit);
        }

        if (options?.offset) {
            sql += ' OFFSET ?';
            params.push(options.offset);
        }

        const rows = this.db.prepare(sql).all(...params) as unknown as GoalRow[];
        return rows.map(row => ({
            id: row.id,
            type: row.type,
            content: row.content,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
            entityId: row.entity_id,
            namespaceId: row.namespace_id,
            name: row.name,
            status: row.status,
            description: row.description,
            objectives: JSON.parse(row.objectives),
            userId: row.user_id,
            createdAt: new Date(row.created_at)
        }));
    }

    async createRelationship(relationship: Omit<Relationship, 'id' | 'createdAt'>): Promise<Relationship> {
        if (!this.db) throw new Error('Database not connected');

        const newRelationship: Relationship = {
            id: crypto.randomUUID(),
            type: relationship.type,
            content: relationship.content,
            sourceId: relationship.sourceId,
            targetId: relationship.targetId,
            metadata: relationship.metadata,
            createdAt: new Date()
        };

        this.db.prepare(
            'INSERT INTO relationships (id, source_id, target_id, type, content, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(
            newRelationship.id,
            newRelationship.sourceId,
            newRelationship.targetId,
            newRelationship.type,
            newRelationship.content,
            newRelationship.metadata ? JSON.stringify(newRelationship.metadata) : null,
            newRelationship.createdAt.toISOString()
        );

        return newRelationship;
    }

    async getRelationship(id: UUID): Promise<Relationship> {
        if (!this.db) throw new Error('Database not connected');
        const row = this.db.prepare('SELECT * FROM relationships WHERE id = ?').get(id) as unknown as RelationshipRow;

        if (!row) throw new Error(`Relationship not found: ${id}`);

        return {
            id: row.id,
            type: row.type,
            content: row.content,
            sourceId: row.source_id,
            targetId: row.target_id,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
            createdAt: new Date(row.created_at)
        };
    }

    async updateRelationship(id: UUID, updates: Partial<Relationship>): Promise<Relationship> {
        if (!this.db) throw new Error('Database not connected');
        const relationship = await this.getRelationship(id);

        const metadata = updates.metadata ? JSON.stringify(updates.metadata) : undefined;

        this.db.prepare(
            `UPDATE relationships 
             SET source_id = ?, target_id = ?, type = ?, content = ?, metadata = ?
             WHERE id = ?`
        ).run(
            updates.sourceId ?? relationship.sourceId,
            updates.targetId ?? relationship.targetId,
            updates.type ?? relationship.type,
            updates.content ?? relationship.content,
            metadata ?? relationship.metadata ? JSON.stringify(relationship.metadata) : null,
            id
        );

        return this.getRelationship(id);
    }

    async deleteRelationship(id: UUID): Promise<void> {
        if (!this.db) throw new Error('Database not connected');
        this.db.prepare('DELETE FROM relationships WHERE id = ?').run(id);
    }

    async listRelationships(options?: QueryOptions): Promise<Relationship[]> {
        if (!this.db) throw new Error('Database not connected');
        let sql = 'SELECT * FROM relationships';
        const params: any[] = [];

        if (options?.where) {
            const conditions = Object.entries(options.where)
                .map(([key, value]) => `${key} = ?`)
                .join(' AND ');
            sql += ` WHERE ${conditions}`;
            params.push(...Object.values(options.where));
        }

        if (options?.orderBy) {
            sql += ` ORDER BY ${options.orderBy} ${options.orderDirection || 'ASC'}`;
        }

        if (options?.limit) {
            sql += ' LIMIT ?';
            params.push(options.limit);
        }

        if (options?.offset) {
            sql += ' OFFSET ?';
            params.push(options.offset);
        }

        const rows = this.db.prepare(sql).all(...params) as unknown as RelationshipRow[];
        return rows.map(row => ({
            id: row.id,
            type: row.type,
            content: row.content,
            sourceId: row.source_id,
            targetId: row.target_id,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
            createdAt: new Date(row.created_at)
        }));
    }

    async createKnowledge(knowledge: Omit<Knowledge, 'id' | 'createdAt'>): Promise<Knowledge> {
        if (!this.db) throw new Error('Database not connected');

        const newKnowledge: Knowledge = {
            id: crypto.randomUUID(),
            type: knowledge.type,
            content: knowledge.content,
            metadata: knowledge.metadata,
            createdAt: new Date()
        };

        this.db.prepare(
            'INSERT INTO knowledge (id, type, content, metadata, created_at) VALUES (?, ?, ?, ?, ?)'
        ).run(
            newKnowledge.id,
            newKnowledge.type,
            newKnowledge.content,
            newKnowledge.metadata ? JSON.stringify(newKnowledge.metadata) : null,
            newKnowledge.createdAt.toISOString()
        );

        return newKnowledge;
    }

    async getKnowledge(id: UUID): Promise<Knowledge> {
        if (!this.db) throw new Error('Database not connected');
        const row = this.db.prepare('SELECT * FROM knowledge WHERE id = ?').get(id) as unknown as KnowledgeRow;

        if (!row) throw new Error(`Knowledge not found: ${id}`);

        return {
            id: row.id,
            type: row.type,
            content: row.content,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
            createdAt: new Date(row.created_at)
        };
    }

    async updateKnowledge(id: UUID, updates: Partial<Knowledge>): Promise<Knowledge> {
        if (!this.db) throw new Error('Database not connected');
        const knowledge = await this.getKnowledge(id);

        const metadata = updates.metadata ? JSON.stringify(updates.metadata) : undefined;

        this.db.prepare(
            `UPDATE knowledge 
             SET type = ?, content = ?, metadata = ?
             WHERE id = ?`
        ).run(
            updates.type ?? knowledge.type,
            updates.content ?? knowledge.content,
            metadata ?? knowledge.metadata ? JSON.stringify(knowledge.metadata) : null,
            id
        );

        return this.getKnowledge(id);
    }

    async deleteKnowledge(id: UUID): Promise<void> {
        if (!this.db) throw new Error('Database not connected');
        this.db.prepare('DELETE FROM knowledge WHERE id = ?').run(id);
    }

    async listKnowledge(options?: QueryOptions): Promise<Knowledge[]> {
        if (!this.db) throw new Error('Database not connected');
        let sql = 'SELECT * FROM knowledge';
        const params: any[] = [];

        if (options?.where) {
            const conditions = Object.entries(options.where)
                .map(([key, value]) => `${key} = ?`)
                .join(' AND ');
            sql += ` WHERE ${conditions}`;
            params.push(...Object.values(options.where));
        }

        if (options?.orderBy) {
            sql += ` ORDER BY ${options.orderBy} ${options.orderDirection || 'ASC'}`;
        }

        if (options?.limit) {
            sql += ' LIMIT ?';
            params.push(options.limit);
        }

        if (options?.offset) {
            sql += ' OFFSET ?';
            params.push(options.offset);
        }

        const rows = await this.executeQuery<KnowledgeRow>(sql, params);
        return rows.map(row => ({
            id: row.id,
            type: row.type,
            content: row.content,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
            createdAt: new Date(row.created_at)
        }));
    }

    async searchKnowledge(query: string, options?: VectorSearchOptions): Promise<Knowledge[]> {
        // TODO: Implement vector search
        return [];
    }

    async setCache(entry: Omit<CacheEntry, 'createdAt'>): Promise<CacheEntry> {
        if (!this.db) throw new Error('Database not connected');

        const newEntry: CacheEntry = {
            key: entry.key,
            value: entry.value,
            entityId: entry.entityId,
            expiresAt: entry.expiresAt,
            createdAt: new Date()
        };

        this.db.prepare(
            'INSERT OR REPLACE INTO cache (key, value, entity_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
        ).run(
            newEntry.key,
            JSON.stringify(newEntry.value),
            newEntry.entityId,
            newEntry.expiresAt?.toISOString(),
            newEntry.createdAt.toISOString()
        );

        return newEntry;
    }

    async getCache(key: string, entityId: UUID): Promise<CacheEntry | null> {
        if (!this.db) throw new Error('Database not connected');
        const row = this.db.prepare('SELECT * FROM cache WHERE key = ? AND entity_id = ?').get(key, entityId) as unknown as CacheEntryRow;

        if (!row) return null;

        return {
            key: row.key,
            value: JSON.parse(row.value),
            entityId: row.entity_id,
            expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
            createdAt: new Date(row.created_at)
        };
    }

    async deleteCache(key: string, entityId: UUID): Promise<void> {
        if (!this.db) throw new Error('Database not connected');
        this.db.prepare('DELETE FROM cache WHERE key = ? AND entity_id = ?').run(key, entityId);
    }

    async clearExpiredCache(): Promise<void> {
        if (!this.db) throw new Error('Database not connected');
        this.db.prepare('DELETE FROM cache WHERE expires_at < ?').run(new Date().toISOString());
    }

    async listCache(options?: QueryOptions): Promise<CacheEntry[]> {
        if (!this.db) throw new Error('Database not connected');
        let sql = 'SELECT * FROM cache';
        const params: any[] = [];

        if (options?.where) {
            const conditions = Object.entries(options.where)
                .map(([key, value]) => `${key} = ?`)
                .join(' AND ');
            sql += ` WHERE ${conditions}`;
            params.push(...Object.values(options.where));
        }

        if (options?.orderBy) {
            sql += ` ORDER BY ${options.orderBy} ${options.orderDirection || 'ASC'}`;
        }

        if (options?.limit) {
            sql += ' LIMIT ?';
            params.push(options.limit);
        }

        if (options?.offset) {
            sql += ' OFFSET ?';
            params.push(options.offset);
        }

        const rows = this.db.prepare(sql).all(...params) as unknown as CacheEntryRow[];
        return rows.map(row => ({
            key: row.key,
            value: JSON.parse(row.value),
            entityId: row.entity_id,
            expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
            createdAt: new Date(row.created_at)
        }));
    }

    async searchByEmbedding(embedding: number[], options: VectorSearchOptions): Promise<MemoryEntity[]> {
        if (!this.db) throw new Error('Database not connected');

        // Get parameters from options
        const { limit = 10, threshold = 0.7 } = options;

        // Retrieve all memories with embeddings
        const rows = this.db.prepare('SELECT * FROM memories WHERE embedding IS NOT NULL').all() as MemoryRow[];

        // Calculate cosine similarity for each memory with an embedding
        // This is done in-memory since SQLite doesn't have built-in vector operations
        const results = [];

        for (const row of rows) {
            try {
                // Skip if no embedding
                if (!row.embedding) continue;

                // Convert Buffer to number array - use Float64Array to match storage format
                const rowEmbedding = new Float64Array(row.embedding.buffer);

                // Calculate cosine similarity
                const similarity = this.calculateCosineSimilarity(embedding, Array.from(rowEmbedding));

                // Only include results above threshold
                if (similarity >= threshold) {
                    results.push({
                        similarity,
                        memory: {
                            id: row.id,
                            type: row.type,
                            content: row.content,
                            name: row.name,
                            metadata: row.metadata ? JSON.parse(row.metadata) : {},
                            entityId: row.entity_id,
                            namespaceId: row.namespace_id,
                            agentId: row.agent_id,
                            isUnique: Boolean(row.is_unique),
                            embedding: Array.from(rowEmbedding),
                            createdAt: new Date(row.created_at)
                        }
                    });
                }
            } catch (error) {
                console.error('Error processing embedding:', error);
            }
        }

        // Sort by similarity (highest first) and limit results
        return results
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit)
            .map(item => item.memory);
    }

    private calculateCosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) {
            throw new Error(`Embedding vectors must have the same dimension (${a.length} vs ${b.length})`);
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        normA = Math.sqrt(normA);
        normB = Math.sqrt(normB);

        if (normA === 0 || normB === 0) {
            return 0;
        }

        return dotProduct / (normA * normB);
    }

    async getRelationships(entityId: UUID): Promise<Relationship[]> {
        if (!this.db) throw new Error('Database not connected');
        const results = this.db.prepare(
            'SELECT * FROM relationships WHERE source_id = ? OR target_id = ?'
        ).all(entityId, entityId) as unknown as RelationshipRow[];
        return results.map(r => ({
            id: r.id,
            type: r.type,
            content: r.content,
            sourceId: r.source_id,
            targetId: r.target_id,
            metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
            createdAt: new Date(r.created_at)
        }));
    }

    async deleteAllGoals(): Promise<void> {
        if (!this.db) throw new Error('Database not connected');
        this.db.prepare('DELETE FROM goals').run();
    }

    async setCacheEntry(entry: Omit<CacheEntry, 'createdAt'>): Promise<CacheEntry> {
        if (!this.db) throw new Error('Database not connected');
        const newEntry: CacheEntry = {
            ...entry,
            createdAt: new Date()
        };
        this.db.prepare(
            'INSERT INTO cache (key, value, entity_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
        ).run(
            entry.key,
            JSON.stringify(entry.value),
            entry.entityId,
            entry.expiresAt?.toISOString(),
            newEntry.createdAt.toISOString()
        );
        return newEntry;
    }

    async getCacheEntry(key: string): Promise<CacheEntry | null> {
        if (!this.db) throw new Error('Database not connected');
        const result = this.db.prepare('SELECT * FROM cache WHERE key = ?').get(key) as unknown as CacheEntryRow;
        if (!result) return null;
        return {
            key: result.key,
            value: JSON.parse(result.value),
            entityId: result.entity_id,
            expiresAt: result.expires_at ? new Date(result.expires_at) : undefined,
            createdAt: new Date(result.created_at)
        };
    }

    async deleteCacheEntry(key: string): Promise<void> {
        if (!this.db) throw new Error('Database not connected');
        this.db.prepare('DELETE FROM cache WHERE key = ?').run(key);
    }

    async listCacheEntries(options?: QueryOptions): Promise<CacheEntry[]> {
        if (!this.db) throw new Error('Database not connected');
        let sql = 'SELECT * FROM cache';
        const params: any[] = [];

        if (options?.where) {
            const conditions = Object.entries(options.where)
                .map(([key, value]) => `${key} = ?`)
                .join(' AND ');
            sql += ` WHERE ${conditions}`;
            params.push(...Object.values(options.where));
        }

        if (options?.orderBy) {
            sql += ` ORDER BY ${options.orderBy} ${options.orderDirection || 'ASC'}`;
        }

        if (options?.limit) {
            sql += ' LIMIT ?';
            params.push(options.limit);
        }

        if (options?.offset) {
            sql += ' OFFSET ?';
            params.push(options.offset);
        }

        const rows = await this.executeQuery<CacheEntryRow>(sql, params);
        return rows.map(row => ({
            key: row.key,
            value: JSON.parse(row.value),
            entityId: row.entity_id,
            expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
            createdAt: new Date(row.created_at)
        }));
    }

    async createNamespace(data: Omit<Namespace, 'id' | 'createdAt'>): Promise<Namespace> {
        if (!this.db) throw new Error('Database not connected');
        const id = uuidv4();
        const createdAt = new Date();
        this.db.prepare(
            'INSERT INTO namespaces (id, name, description, metadata, created_at) VALUES (?, ?, ?, ?, ?)'
        ).run(
            id,
            data.name,
            data.description,
            JSON.stringify(data.metadata),
            createdAt.toISOString()
        );
        return { ...data, id, createdAt };
    }

    async getNamespace(id: UUID): Promise<Namespace | null> {
        if (!this.db) throw new Error('Database not connected');
        const result = this.db.prepare('SELECT * FROM namespaces WHERE id = ?').get(id) as unknown as NamespaceRow;
        if (!result) return null;
        return {
            id: result.id,
            name: result.name,
            description: result.description,
            metadata: result.metadata ? JSON.parse(result.metadata) : {},
            createdAt: new Date(result.created_at)
        };
    }

    async updateNamespace(id: UUID, updates: Partial<Omit<Namespace, 'id' | 'createdAt'>>): Promise<Namespace> {
        if (!this.db) throw new Error('Database not connected');
        const updatesList = [];
        const params = [];

        if (updates.name) {
            updatesList.push('name = ?');
            params.push(updates.name);
        }
        if (updates.description) {
            updatesList.push('description = ?');
            params.push(updates.description);
        }
        if (updates.metadata) {
            updatesList.push('metadata = ?');
            params.push(JSON.stringify(updates.metadata));
        }

        if (updatesList.length === 0) {
            throw new Error('No updates provided');
        }

        params.push(id);
        this.db.prepare(
            `UPDATE namespaces SET ${updatesList.join(', ')} WHERE id = ?`
        ).run(...params);

        const updated = await this.getNamespace(id);
        if (!updated) throw new Error('Namespace not found after update');
        return updated;
    }

    async deleteNamespace(id: UUID): Promise<void> {
        if (!this.db) throw new Error('Database not connected');
        this.db.prepare('DELETE FROM namespaces WHERE id = ?').run(id);
    }

    async listNamespaces(options?: QueryOptions): Promise<Namespace[]> {
        if (!this.db) throw new Error('Database not connected');
        let sql = 'SELECT * FROM namespaces';
        const params: any[] = [];

        if (options?.where) {
            const conditions = Object.entries(options.where)
                .map(([key, value]) => `${key} = ?`)
                .join(' AND ');
            sql += ` WHERE ${conditions}`;
            params.push(...Object.values(options.where));
        }

        if (options?.orderBy) {
            sql += ` ORDER BY ${options.orderBy} ${options.orderDirection || 'ASC'}`;
        }

        if (options?.limit) {
            sql += ' LIMIT ?';
            params.push(options.limit);
        }

        if (options?.offset) {
            sql += ' OFFSET ?';
            params.push(options.offset);
        }

        const rows = this.db.prepare(sql).all(...params) as unknown as NamespaceRow[];
        return rows.map(row => ({
            id: row.id,
            name: row.name,
            description: row.description,
            metadata: row.metadata ? JSON.parse(row.metadata) : {},
            createdAt: new Date(row.created_at)
        }));
    }

    async removeNamespaceMember(id: UUID): Promise<void> {
        if (!this.db) throw new Error('Database not connected');
        this.db.prepare('DELETE FROM namespace_members WHERE id = ?').run(id);
    }
} 