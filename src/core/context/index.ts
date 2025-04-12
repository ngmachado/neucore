/**
 * Context Module for NeuroCore
 * 
 * Exports the unified context builder and its related types.
 */

export * from './contextBuilder';

// Re-export main types for easy access
export {
    ContextBuilder,
    ContextSourceType,
    ContextItem,
    AssembledContext,
    ContextBuildOptions
} from './contextBuilder';

// Factory function for creating a context builder
import { ContextBuilder } from './contextBuilder';

/**
 * Create a context builder with the specified dependencies
 * 
 * @param dependencies The components needed for context building
 * @returns A configured context builder
 */
export function createContextBuilder(dependencies: {
    memoryManager?: any;
    ragManager?: any;
    goalsManager?: any;
    userProfileManager?: any;
    logger?: any;
}): ContextBuilder {
    return new ContextBuilder(dependencies);
} 