/**
 * Message Content Protocol (MCP) Module
 * 
 * This module provides a modern intent-based system for
 * message routing and handling within NeuroCore.
 */

// Export the core intent system
export * from './intent';
export * from './intentFilter';
export * from './intentHandler';
export * from './intentRouter'; // The renamed file

// Re-export intent-related types for easy access
export { Intent, IntentFlags } from './intent';
export { IntentFilter } from './intentFilter';
export {
    IntentHandler,
    BaseIntentHandler,
    IntentResult,
    IntentContext
} from './intentHandler';
export { IntentRouter } from './intentRouter';

// Create a factory function for intent system components
import { IntentRouter } from './intentRouter';

/**
 * Create an intent router with default configuration
 * @param logger Optional logger instance
 * @returns Configured intent router instance
 */
export function createIntentRouter(logger?: any): IntentRouter {
    return new IntentRouter(logger);
} 