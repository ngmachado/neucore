/**
 * Neucore - Modern AI framework for building context-aware AI applications
 */

// Core types
export * from './types';

// Core modules - export selectively to avoid name conflicts
// Remove the wildcard export that causes conflicts
// export * from './core';

// Remove non-existent exports
// export {
//     getLogger,
//     LogLevel,
//     LogOptions
// } from './core/logging';

export {
    DatabaseAdapter,
    DatabaseStatus,
    QueryOptions,
    VectorSearchOptions,
    Entity,
    MemoryEntity,
    Namespace,
    NamespaceMember,
    Knowledge,
    CacheEntry
} from './core/database/interfaces';

// Replace wildcard with specific exports to avoid naming conflicts
export {
    DatabaseService,
    // Exclude Goal and Relationship exports that conflict with ./types
} from './core/database';

export * from './core/logging';
export * from './core/errors';
export * from './core/memory/types';
export * from './core/actions';
export * from './core/actions/types';
export * from './core/rag';
export * from './core/relationships';
export * from './core/config';

// Disabled due to missing module
// export * from './core/reasoning';

// MCP - explicitly export interfaces to avoid naming conflicts
export { Intent } from './mcp/intent';
export {
    IPlugin,
    PluginResult,
    RequestContext
} from './mcp/interfaces/plugin';
export * from './mcp/interfaces/provider';
export * from './mcp/intentManager';
export * from './mcp/mcp';
export * from './mcp/pluginManager';
export * from './mcp/providerManager';

// Runtime
export * from './runtime';
export * from './runtime/context';
export * from './runtime/memory';
export * from './runtime/embedding';

// Utils
export function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
} 