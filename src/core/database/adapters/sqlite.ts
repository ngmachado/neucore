import { DatabaseAdapter, QueryOptions, VectorSearchOptions, DatabaseStatus, Entity, Namespace, NamespaceMember, MemoryEntity, Relationship, Goal, Knowledge, CacheEntry } from '../interfaces';
import { UUID } from '../../types';
import { open, Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import crypto from 'crypto';

/**
 * SQLite adapter implementation for relationships
 */
export class SQLiteAdapter implements DatabaseAdapter {
    private db: Database | null = null;
    private isConnected = false;

    constructor(private config: { path: string }) { }

    async connect(): Promise<void> {
        if (this.isConnected) return;
        this.db = await open({
            filename: this.config.path,
            driver: sqlite3.Database
        });
        await this.initializeTables();
        this.isConnected = true;
    }

    async disconnect(): Promise<void> {
        if (!this.isConnected) return;
        await this.db?.close();
        this.db = null;
        this.isConnected = false;
    }

    private async initializeTables(): Promise<void> {
        if (!this.db) throw new Error('Database not connected');
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS entities (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                content TEXT NOT NULL,
                name TEXT,
                metadata TEXT,
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
                entity_id TEXT,
                namespace_id TEXT,
                agent_id TEXT,
                unique BOOLEAN,
                embedding TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (entity_id) REFERENCES entities(id),
                FOREIGN KEY (namespace_id) REFERENCES namespaces(id)
            );
            CREATE TABLE IF NOT EXISTS relationships (
                id TEXT PRIMARY KEY,
                source_id TEXT NOT NULL,
                target_id TEXT NOT NULL,
                type TEXT NOT NULL,
                metadata TEXT NOT NULL,
                user_a TEXT,
                user_b TEXT,
                status TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (source_id) REFERENCES entities(id),
                FOREIGN KEY (target_id) REFERENCES entities(id)
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
                created_at TEXT NOT NULL,
                FOREIGN KEY (entity_id) REFERENCES entities(id),
                FOREIGN KEY (namespace_id) REFERENCES namespaces(id)
            );
            CREATE TABLE IF NOT EXISTS knowledge (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                metadata TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS cache_entries (
                id TEXT PRIMARY KEY,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                expires_at TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (entity_id) REFERENCES entities(id)
            );
        `);
    }

    async getStatus(): Promise<DatabaseStatus> {
        if (!this.db) throw new Error('Database not connected');
        const [memoryCount, relationshipCount, goalCount] = await Promise.all([
            this.db.get('SELECT COUNT(*) as count FROM memories'),
            this.db.get('SELECT COUNT(*) as count FROM relationships'),
            this.db.get('SELECT COUNT(*) as count FROM goals')
        ]);
        return {
            connected: this.isConnected,
            memoryCount: memoryCount?.count || 0,
            relationshipCount: relationshipCount?.count || 0,
            goalCount: goalCount?.count || 0
        };
    }

    async executeQuery<T>(query: string, params: any[] = []): Promise<T[]> {
        if (!this.db) throw new Error('Database not connected');
        return this.db.all(query, params);
    }

    async createEntity(data: Omit<Entity, 'id' | 'createdAt'>): Promise<Entity> {
        if (!this.db) throw new Error('Database not connected');
        const id = crypto.randomUUID();
        const now = new Date();
        const metadata = data.metadata ? JSON.stringify(data.metadata) : null;

        await this.db.run(
            `INSERT INTO entities (id, type, content, name, metadata, created_at) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [id, data.type, data.content, data.name, metadata, now.toISOString()]
        );

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
        const row = await this.db.get(
            'SELECT * FROM entities WHERE id = ?',
            [id]
        );

        if (!row) return null;

        return {
            id: row.id,
            type: row.type,
            content: row.content,
            name: row.name,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
            createdAt: new Date(row.created_at)
        };
    }

    async updateEntity(id: UUID, updates: Partial<Entity>): Promise<Entity> {
        if (!this.db) throw new Error('Database not connected');
        const entity = await this.getEntity(id);
        if (!entity) throw new Error('Entity not found');

        const metadata = updates.metadata ? JSON.stringify(updates.metadata) : undefined;

        await this.db.run(
            `UPDATE entities 
             SET type = ?, content = ?, name = ?, metadata = ?
             WHERE id = ?`,
            [
                updates.type ?? entity.type,
                updates.content ?? entity.content,
                updates.name ?? entity.name,
                metadata ?? entity.metadata ? JSON.stringify(entity.metadata) : null,
                id
            ]
        );

        const updated = await this.getEntity(id);
        if (!updated) throw new Error('Entity not found after update');
        return updated;
    }

    async deleteEntity(id: UUID): Promise<void> {
        if (!this.db) throw new Error('Database not connected');
        await this.db.run('DELETE FROM entities WHERE id = ?', [id]);
    }

    async listEntities(options?: QueryOptions): Promise<Entity[]> {
        if (!this.db) throw new Error('Database not connected');
        let sql = 'SELECT * FROM entities';
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

        const rows = await this.db.all(sql, params);
        return rows.map(row => ({
            id: row.id,
            type: row.type,
            content: row.content,
            name: row.name,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
            createdAt: new Date(row.created_at)
        }));
    }

    // Namespace operations
    async createNamespace(data: Omit<Namespace, 'id' | 'createdAt'>): Promise<Namespace> {
        if (!this.db) throw new Error('Database not initialized');
        const id = crypto.randomUUID();
        const createdAt = new Date();
        await this.db.run(
            'INSERT INTO namespaces (id, name, description, metadata, createdAt) VALUES (?, ?, ?, ?, ?)',
            id,
            data.name,
            data.description || null,
            JSON.stringify(data.metadata || {}),
            createdAt.toISOString()
        );
        return { id, ...data, createdAt };
    }

    async getNamespace(id: UUID): Promise<Namespace | null> {
        if (!this.db) throw new Error('Database not connected');
        const row = await this.db.get(
            'SELECT * FROM namespaces WHERE id = ?',
            [id]
        );

        if (!row) return null;

        return {
            id: row.id,
            name: row.name,
            description: row.description,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
            createdAt: new Date(row.created_at)
        };
    }

    async updateNamespace(id: UUID, updates: Partial<Namespace>): Promise<Namespace> {
        if (!this.db) throw new Error('Database not initialized');
        const current = await this.getNamespace(id);
        if (!current) throw new Error('Namespace not found');
        const updated = { ...current, ...updates };
        await this.db.run(
            'UPDATE namespaces SET name = ?, description = ?, metadata = ? WHERE id = ?',
            updated.name,
            updated.description || null,
            JSON.stringify(updated.metadata || {}),
            id
        );
        return updated;
    }

    async deleteNamespace(id: UUID): Promise<void> {
        if (!this.db) throw new Error('Database not connected');
        await this.db.run('DELETE FROM namespaces WHERE id = ?', id);
    }

    async listNamespaces(options?: QueryOptions): Promise<Namespace[]> {
        if (!this.db) throw new Error('Database not connected');
        let sql = 'SELECT * FROM namespaces';
        const params: any[] = [];

        if (options?.where) {
            const conditions = Object.entries(options.where)
                .map(([key, value]) => {
                    // Convert camelCase to snake_case in SQL query
                    const dbKey = key === 'createdAt' ? 'created_at' : key;
                    return `${dbKey} = ?`;
                })
                .join(' AND ');

            sql += ` WHERE ${conditions}`;
            params.push(...Object.values(options.where));
        }

        if (options?.orderBy) {
            // Convert camelCase to snake_case in SQL query
            const dbOrderBy = options.orderBy === 'createdAt' ? 'created_at' : options.orderBy;
            sql += ` ORDER BY ${dbOrderBy} ${options.orderDirection || 'ASC'}`;
        }

        if (options?.limit) {
            sql += ' LIMIT ?';
            params.push(options.limit);
        }

        if (options?.offset) {
            sql += ' OFFSET ?';
            params.push(options.offset);
        }

        const rows = await this.db.all(sql, params);

        return rows.map(row => ({
            id: row.id,
            name: row.name,
            description: row.description,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
            createdAt: new Date(row.created_at)
        }));
    }

    // Namespace member operations
    async createNamespaceMember(data: Omit<NamespaceMember, 'id' | 'createdAt'>): Promise<NamespaceMember> {
        if (!this.db) throw new Error('Database not initialized');
        const id = crypto.randomUUID();
        const createdAt = new Date();
        await this.db.run(
            'INSERT INTO namespace_members (id, namespaceId, entityId, role, metadata, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
            id,
            data.namespaceId,
            data.entityId,
            data.role,
            JSON.stringify(data.metadata || {}),
            createdAt.toISOString()
        );
        return { id, ...data, createdAt };
    }

    async getNamespaceMember(id: UUID): Promise<NamespaceMember | null> {
        if (!this.db) throw new Error('Database not connected');
        const result = await this.db.get('SELECT * FROM namespace_members WHERE id = ?', id);
        if (!result) return null;
        return {
            ...result,
            metadata: JSON.parse(result.metadata || '{}'),
            createdAt: new Date(result.createdAt)
        };
    }

    async updateNamespaceMember(id: UUID, updates: Partial<NamespaceMember>): Promise<NamespaceMember> {
        if (!this.db) throw new Error('Database not initialized');
        const current = await this.getNamespaceMember(id);
        if (!current) throw new Error('Namespace member not found');
        const updated = { ...current, ...updates };
        await this.db.run(
            'UPDATE namespace_members SET namespaceId = ?, entityId = ?, role = ?, metadata = ? WHERE id = ?',
            updated.namespaceId,
            updated.entityId,
            updated.role,
            JSON.stringify(updated.metadata || {}),
            id
        );
        return updated;
    }

    async removeNamespaceMember(id: UUID): Promise<void> {
        if (!this.db) throw new Error('Database not connected');
        await this.db.run('DELETE FROM namespace_members WHERE id = ?', id);
    }

    async listNamespaceMembers(namespaceId: UUID, options?: QueryOptions): Promise<NamespaceMember[]> {
        if (!this.db) throw new Error('Database not connected');
        const { limit = 100, offset = 0 } = options || {};
        const results = await this.db.all(
            'SELECT * FROM namespace_members WHERE namespaceId = ? ORDER BY createdAt DESC LIMIT ? OFFSET ?',
            namespaceId, limit, offset
        );
        return results.map((r: any) => ({
            ...r,
            metadata: JSON.parse(r.metadata || '{}'),
            createdAt: new Date(r.createdAt)
        }));
    }

    // Memory operations
    async createMemory(memory: Omit<MemoryEntity, "id" | "createdAt">): Promise<MemoryEntity> {
        if (!this.db) throw new Error('Database not connected');
        const id = crypto.randomUUID();
        const now = new Date();
        const embedding = memory.embedding ? JSON.stringify(memory.embedding) : null;
        const metadata = memory.metadata ? JSON.stringify(memory.metadata) : null;

        await this.db.run(
            `INSERT INTO memories (
                id, type, content, entity_id, namespace_id, agent_id, 
                unique, embedding, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                memory.type || 'memory',
                memory.content || '',
                memory.entityId || null,
                memory.namespaceId || null,
                memory.agentId || null,
                memory.isUnique ? 1 : 0,
                embedding,
                now.toISOString()
            ]
        );

        return {
            id,
            type: memory.type || 'memory',
            content: memory.content || '',
            entityId: memory.entityId,
            namespaceId: memory.namespaceId,
            agentId: memory.agentId,
            isUnique: !!memory.isUnique,
            embedding: memory.embedding,
            metadata: memory.metadata || {},
            createdAt: now
        };
    }

    async getMemory(id: UUID): Promise<MemoryEntity> {
        if (!this.db) throw new Error('Database not connected');
        const row = await this.db.get('SELECT * FROM memories WHERE id = ?', [id]);
        if (!row) throw new Error(`Memory not found with id: ${id}`);

        return {
            id: row.id,
            type: row.type || 'memory',
            content: row.content || '',
            entityId: row.entity_id,
            namespaceId: row.namespace_id,
            agentId: row.agent_id,
            isUnique: Boolean(row.unique),
            embedding: row.embedding ? JSON.parse(row.embedding) : undefined,
            metadata: row.metadata ? JSON.parse(row.metadata) : {},
            createdAt: new Date(row.created_at)
        };
    }

    async updateMemory(id: UUID, memory: Partial<MemoryEntity>): Promise<MemoryEntity> {
        if (!this.db) throw new Error('Database not connected');

        const existing = await this.getMemory(id);
        if (!existing) throw new Error(`Memory ${id} not found`);

        const updatedMemory: MemoryEntity = {
            ...existing,
            ...memory,
            id,
            createdAt: existing.createdAt
        };

        const updates: string[] = [];
        const values: any[] = [];

        if (memory.type !== undefined) {
            updates.push('type = ?');
            values.push(memory.type);
        }
        if (memory.content !== undefined) {
            updates.push('content = ?');
            values.push(JSON.stringify(memory.content));
        }
        if (memory.metadata !== undefined) {
            updates.push('metadata = ?');
            values.push(JSON.stringify(memory.metadata));
        }

        if (updates.length > 0) {
            await this.db.run(
                `UPDATE memories SET ${updates.join(', ')} WHERE id = ?`,
                ...values,
                id
            );
        }

        return updatedMemory;
    }

    async deleteMemory(id: UUID): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');
        await this.db.run('DELETE FROM memories WHERE id = ?', id);
    }

    async listMemories(options?: QueryOptions): Promise<MemoryEntity[]> {
        if (!this.db) throw new Error('Database not connected');
        let sql = 'SELECT * FROM memories';
        const params: any[] = [];

        if (options?.where) {
            const conditions = Object.entries(options.where)
                .map(([key, value]) => {
                    // Convert camelCase to snake_case in SQL query
                    const dbKey = key === 'entityId' ? 'entity_id' :
                        key === 'namespaceId' ? 'namespace_id' :
                            key === 'agentId' ? 'agent_id' :
                                key === 'createdAt' ? 'created_at' : key;
                    return `${dbKey} = ?`;
                })
                .join(' AND ');

            sql += ` WHERE ${conditions}`;
            params.push(...Object.values(options.where));
        }

        if (options?.orderBy) {
            // Convert camelCase to snake_case in SQL query
            const dbOrderBy = options.orderBy === 'entityId' ? 'entity_id' :
                options.orderBy === 'namespaceId' ? 'namespace_id' :
                    options.orderBy === 'agentId' ? 'agent_id' :
                        options.orderBy === 'createdAt' ? 'created_at' : options.orderBy;

            sql += ` ORDER BY ${dbOrderBy} ${options.orderDirection || 'ASC'}`;
        }

        if (options?.limit) {
            sql += ' LIMIT ?';
            params.push(options.limit);
        }

        if (options?.offset) {
            sql += ' OFFSET ?';
            params.push(options.offset);
        }

        const rows = await this.db.all(sql, params);

        return rows.map(row => ({
            id: row.id,
            type: row.type || 'memory',
            content: row.content || '',
            entityId: row.entity_id,
            namespaceId: row.namespace_id,
            agentId: row.agent_id,
            isUnique: Boolean(row.unique),
            embedding: row.embedding ? JSON.parse(row.embedding) : undefined,
            metadata: row.metadata ? JSON.parse(row.metadata) : {},
            createdAt: new Date(row.created_at)
        }));
    }

    async searchByEmbedding(embedding: number[], options: VectorSearchOptions): Promise<MemoryEntity[]> {
        if (!this.db) throw new Error('Database not initialized');
        // This is a placeholder implementation. In a real system, you would use a vector similarity search
        return this.listMemories({ limit: options.limit });
    }

    // Knowledge operations
    async createKnowledge(knowledge: Omit<Knowledge, 'id' | 'createdAt'>): Promise<Knowledge> {
        if (!this.db) throw new Error('Database not initialized');
        const id = crypto.randomUUID();
        const now = new Date();
        const newKnowledge: Knowledge = {
            id,
            ...knowledge,
            createdAt: now
        };
        await this.db.run(
            'INSERT INTO knowledge (id, type, content, metadata, createdAt) VALUES (?, ?, ?, ?, ?)',
            id,
            knowledge.type,
            knowledge.content,
            JSON.stringify(knowledge.metadata || {}),
            now.toISOString()
        );
        return newKnowledge;
    }

    async getKnowledge(id: UUID): Promise<Knowledge> {
        if (!this.db) throw new Error('Database not initialized');
        const result = await this.db.get('SELECT * FROM knowledge WHERE id = ?', id);
        if (!result) throw new Error(`Knowledge not found: ${id}`);
        return {
            id: result.id,
            type: result.type,
            content: result.content,
            metadata: JSON.parse(result.metadata || '{}'),
            createdAt: new Date(result.createdAt)
        };
    }

    async updateKnowledge(id: UUID, updates: Partial<Knowledge>): Promise<Knowledge> {
        if (!this.db) throw new Error('Database not initialized');
        const knowledge = await this.getKnowledge(id);
        const updatedKnowledge = { ...knowledge, ...updates };
        await this.db.run(
            'UPDATE knowledge SET type = ?, content = ?, metadata = ? WHERE id = ?',
            updatedKnowledge.type,
            updatedKnowledge.content,
            JSON.stringify(updatedKnowledge.metadata || {}),
            id
        );
        return updatedKnowledge;
    }

    async deleteKnowledge(id: UUID): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');
        await this.db.run('DELETE FROM knowledge WHERE id = ?', id);
    }

    async listKnowledge(options?: QueryOptions): Promise<Knowledge[]> {
        if (!this.db) throw new Error('Database not initialized');
        let query = 'SELECT * FROM knowledge';
        const params: any[] = [];
        if (options?.where) {
            const conditions = Object.entries(options.where).map(([key, value]) => {
                params.push(value);
                return `${key} = ?`;
            });
            if (conditions.length > 0) {
                query += ` WHERE ${conditions.join(' AND ')}`;
            }
        }
        if (options?.orderBy) {
            query += ` ORDER BY ${options.orderBy} ${options.orderDirection || 'ASC'}`;
        }
        if (options?.limit) {
            query += ` LIMIT ${options.limit}`;
            if (options.offset) {
                query += ` OFFSET ${options.offset}`;
            }
        }
        const rows = await this.db.all(query, ...params);
        return rows.map(row => ({
            id: row.id,
            type: row.type,
            content: row.content,
            metadata: JSON.parse(row.metadata || '{}'),
            createdAt: new Date(row.createdAt)
        }));
    }

    async searchKnowledge(query: string, options?: VectorSearchOptions): Promise<Knowledge[]> {
        if (!this.db) throw new Error('Database not connected');
        // TODO: Implement semantic search
        return [];
    }

    // Cache operations
    async setCache(entry: Omit<CacheEntry, 'createdAt'>): Promise<CacheEntry> {
        if (!this.db) throw new Error('Database not connected');
        const createdAt = Date.now();
        await this.db.run(
            'INSERT OR REPLACE INTO cache (key, entityId, value, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?)',
            entry.key, entry.entityId, JSON.stringify(entry.value),
            entry.expiresAt?.getTime(), createdAt
        );
        return { ...entry, createdAt: new Date(createdAt) };
    }

    async getCache(key: string, entityId: UUID, namespaceId?: UUID): Promise<CacheEntry | null> {
        if (!this.db) throw new Error('Database not connected');
        const result = await this.db.get(
            'SELECT * FROM cache WHERE key = ? AND entityId = ? AND (namespaceId = ? OR namespaceId IS NULL)',
            key, entityId, namespaceId
        );
        if (!result) return null;
        return {
            ...result,
            value: JSON.parse(result.value),
            expiresAt: result.expiresAt ? new Date(result.expiresAt) : undefined,
            createdAt: new Date(result.createdAt)
        };
    }

    async deleteCache(key: string, entityId: UUID, namespaceId?: UUID): Promise<void> {
        if (!this.db) throw new Error('Database not connected');
        await this.db.run(
            'DELETE FROM cache WHERE key = ? AND entityId = ? AND (namespaceId = ? OR namespaceId IS NULL)',
            key, entityId, namespaceId
        );
    }

    async clearExpiredCache(): Promise<void> {
        if (!this.db) throw new Error('Database not connected');
        await this.db.run('DELETE FROM cache WHERE expiresAt < ?', Date.now());
    }

    async getMemories(options: QueryOptions): Promise<MemoryEntity[]> {
        return this.listMemories(options);
    }

    async getRelationship(id: UUID): Promise<Relationship> {
        if (!this.db) throw new Error('Database not initialized');
        const result = await this.db.get('SELECT * FROM relationships WHERE id = ?', id);
        if (!result) throw new Error(`Relationship not found: ${id}`);
        return {
            id: result.id,
            type: result.type,
            content: result.content,
            sourceId: result.sourceId,
            targetId: result.targetId,
            metadata: JSON.parse(result.metadata || '{}'),
            userA: result.userA,
            userB: result.userB,
            status: result.status,
            createdAt: new Date(result.createdAt)
        };
    }

    async getRelationships(entityId: UUID): Promise<Relationship[]> {
        if (!this.db) throw new Error('Database not initialized');
        const rows = await this.db.all(
            'SELECT * FROM relationships WHERE sourceId = ? OR targetId = ?',
            entityId,
            entityId
        );
        return rows.map(row => ({
            id: row.id,
            type: row.type,
            content: row.content,
            sourceId: row.sourceId,
            targetId: row.targetId,
            metadata: JSON.parse(row.metadata || '{}'),
            userA: row.userA,
            userB: row.userB,
            status: row.status,
            createdAt: new Date(row.createdAt)
        }));
    }

    async getGoals(options: QueryOptions): Promise<Goal[]> {
        return this.listGoals(options);
    }

    async createGoal(goal: Omit<Goal, 'id' | 'createdAt'>): Promise<Goal> {
        if (!this.db) throw new Error('Database not initialized');
        const id = crypto.randomUUID();
        const now = new Date();
        const newGoal: Goal = {
            id,
            type: 'goal',
            content: goal.description || '',
            metadata: {},
            entityId: goal.entityId,
            namespaceId: goal.namespaceId,
            name: goal.name,
            status: goal.status,
            description: goal.description,
            objectives: goal.objectives,
            userId: goal.userId,
            createdAt: now
        };
        await this.db.run(
            'INSERT INTO goals (id, entityId, namespaceId, name, status, description, objectives, userId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            id,
            goal.entityId,
            goal.namespaceId,
            goal.name,
            goal.status,
            goal.description,
            JSON.stringify(goal.objectives),
            goal.userId,
            now.toISOString()
        );
        return newGoal;
    }

    async updateGoal(id: UUID, updates: Partial<Goal>): Promise<Goal> {
        if (!this.db) throw new Error('Database not initialized');
        const goal = await this.getGoal(id);
        const updatedGoal = { ...goal, ...updates };
        await this.db.run(
            'UPDATE goals SET entityId = ?, namespaceId = ?, name = ?, status = ?, description = ?, objectives = ?, userId = ? WHERE id = ?',
            updatedGoal.entityId,
            updatedGoal.namespaceId,
            updatedGoal.name,
            updatedGoal.status,
            updatedGoal.description,
            JSON.stringify(updatedGoal.objectives),
            updatedGoal.userId,
            id
        );
        return updatedGoal;
    }

    async deleteGoal(id: UUID): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');
        await this.db.run('DELETE FROM goals WHERE id = ?', id);
    }

    async deleteAllGoals(): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');
        await this.db.run('DELETE FROM goals');
    }

    async listGoals(options?: QueryOptions): Promise<Goal[]> {
        if (!this.db) throw new Error('Database not initialized');
        let query = 'SELECT * FROM goals';
        const params: any[] = [];
        if (options?.where) {
            const conditions = Object.entries(options.where).map(([key, value]) => {
                params.push(value);
                return `${key} = ?`;
            });
            if (conditions.length > 0) {
                query += ` WHERE ${conditions.join(' AND ')}`;
            }
        }
        if (options?.orderBy) {
            query += ` ORDER BY ${options.orderBy} ${options.orderDirection || 'ASC'}`;
        }
        if (options?.limit) {
            query += ` LIMIT ${options.limit}`;
            if (options.offset) {
                query += ` OFFSET ${options.offset}`;
            }
        }
        const rows = await this.db.all(query, ...params);
        return rows.map(row => ({
            id: row.id,
            type: 'goal',
            content: row.description || '',
            metadata: {},
            entityId: row.entityId,
            namespaceId: row.namespaceId,
            name: row.name,
            status: row.status,
            description: row.description,
            objectives: JSON.parse(row.objectives || '[]'),
            userId: row.userId,
            createdAt: new Date(row.createdAt)
        }));
    }

    async addNamespaceMember(member: Omit<NamespaceMember, 'id' | 'createdAt'>): Promise<NamespaceMember> {
        if (!this.db) throw new Error('Database not connected');

        const newMember: NamespaceMember = {
            id: crypto.randomUUID(),
            namespaceId: member.namespaceId,
            entityId: member.entityId,
            role: member.role,
            metadata: member.metadata,
            createdAt: new Date()
        };

        await this.db.run(
            'INSERT INTO namespace_members (id, namespace_id, entity_id, role, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            newMember.id,
            newMember.namespaceId,
            newMember.entityId,
            newMember.role,
            newMember.metadata ? JSON.stringify(newMember.metadata) : null,
            newMember.createdAt.toISOString()
        );

        return newMember;
    }

    async createRelationship(relationship: Omit<Relationship, 'id' | 'createdAt'>): Promise<Relationship> {
        if (!this.db) throw new Error('Database not initialized');
        const id = crypto.randomUUID();
        const now = new Date();
        const newRelationship: Relationship = {
            id,
            type: relationship.type,
            content: relationship.content,
            sourceId: relationship.sourceId,
            targetId: relationship.targetId,
            metadata: relationship.metadata || {},
            userA: relationship.userA,
            userB: relationship.userB,
            status: relationship.status,
            createdAt: now
        };
        await this.db.run(
            'INSERT INTO relationships (id, sourceId, targetId, type, metadata, userA, userB, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            id,
            relationship.sourceId,
            relationship.targetId,
            relationship.type,
            JSON.stringify(relationship.metadata || {}),
            relationship.userA,
            relationship.userB,
            relationship.status,
            now.toISOString()
        );
        return newRelationship;
    }

    async updateRelationship(id: UUID, updates: Partial<Relationship>): Promise<Relationship> {
        if (!this.db) throw new Error('Database not initialized');
        const relationship = await this.getRelationship(id);
        const updatedRelationship = { ...relationship, ...updates };
        await this.db.run(
            'UPDATE relationships SET sourceId = ?, targetId = ?, type = ?, metadata = ?, userA = ?, userB = ?, status = ? WHERE id = ?',
            updatedRelationship.sourceId,
            updatedRelationship.targetId,
            updatedRelationship.type,
            JSON.stringify(updatedRelationship.metadata || {}),
            updatedRelationship.userA,
            updatedRelationship.userB,
            updatedRelationship.status,
            id
        );
        return updatedRelationship;
    }

    async deleteRelationship(id: UUID): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');
        await this.db.run('DELETE FROM relationships WHERE id = ?', id);
    }

    async setCacheEntry(entry: Omit<CacheEntry, 'createdAt'>): Promise<CacheEntry> {
        if (!this.db) throw new Error('Database not initialized');
        const now = new Date();
        const newEntry: CacheEntry = {
            key: entry.key,
            value: entry.value,
            entityId: entry.entityId,
            expiresAt: entry.expiresAt,
            createdAt: now
        };
        await this.db.run(
            'INSERT OR REPLACE INTO cache (key, value, entityId, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?)',
            entry.key,
            entry.value,
            entry.entityId,
            entry.expiresAt?.toISOString(),
            now.toISOString()
        );
        return newEntry;
    }

    async getCacheEntry(key: string): Promise<CacheEntry | null> {
        if (!this.db) throw new Error('Database not initialized');
        const result = await this.db.get('SELECT * FROM cache WHERE key = ?', key);
        if (!result) return null;
        return {
            key: result.key,
            value: result.value,
            entityId: result.entityId,
            expiresAt: result.expiresAt ? new Date(result.expiresAt) : undefined,
            createdAt: new Date(result.createdAt)
        };
    }

    async deleteCacheEntry(key: string): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');
        await this.db.run('DELETE FROM cache WHERE key = ?', key);
    }

    async listCacheEntries(options?: QueryOptions): Promise<CacheEntry[]> {
        if (!this.db) throw new Error('Database not initialized');
        let query = 'SELECT * FROM cache';
        const params: any[] = [];
        if (options?.where) {
            const conditions = Object.entries(options.where).map(([key, value]) => {
                params.push(value);
                return `${key} = ?`;
            });
            if (conditions.length > 0) {
                query += ` WHERE ${conditions.join(' AND ')}`;
            }
        }
        if (options?.orderBy) {
            query += ` ORDER BY ${options.orderBy} ${options.orderDirection || 'ASC'}`;
        }
        if (options?.limit) {
            query += ` LIMIT ${options.limit}`;
            if (options.offset) {
                query += ` OFFSET ${options.offset}`;
            }
        }
        const rows = await this.db.all(query, ...params);
        return rows.map(row => ({
            key: row.key,
            value: row.value,
            entityId: row.entityId,
            expiresAt: row.expiresAt ? new Date(row.expiresAt) : undefined,
            createdAt: new Date(row.createdAt)
        }));
    }

    async getGoal(id: UUID): Promise<Goal> {
        if (!this.db) throw new Error('Database not initialized');
        const result = await this.db.get('SELECT * FROM goals WHERE id = ?', id);
        if (!result) throw new Error(`Goal not found: ${id}`);
        return {
            id: result.id,
            type: 'goal',
            content: result.description || '',
            entityId: result.entityId,
            namespaceId: result.namespaceId,
            name: result.name,
            status: result.status,
            description: result.description,
            objectives: JSON.parse(result.objectives || '[]'),
            userId: result.userId,
            metadata: {},
            createdAt: new Date(result.createdAt)
        };
    }
} 