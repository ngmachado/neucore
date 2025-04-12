/**
 * Action System
 * 
 * Provides a framework for defining, registering, and executing
 * concrete operations that agents can perform. Works in conjunction
 * with the intent system for routing and authorization.
 */

// Export core interfaces and types
export * from './types';

// Export the action manager implementation
export * from './actionManager';

// Export the intent-action bridge
export * from './intentActionBridge';

// Export built-in actions
export * from './builtinActions'; 