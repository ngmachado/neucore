/**
 * NeuroCore - Modern AI framework for building context-aware AI applications
 */

// Core types
export * from './types';

// Core modules
export * from './core';
export * from './core/database/interfaces';
export * from './core/database';
export * from './core/logging';
export * from './core/errors';
export * from './core/memory/types';
export * from './core/actions';
export * from './core/actions/types';
export * from './core/rag';
export * from './core/relationships';
export * from './core/config';

// MCP
export { Intent } from './mcp/intent';
export * from './mcp/interfaces/plugin';
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