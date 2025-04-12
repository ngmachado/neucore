/**
 * Intent Filter System for NeuroCore
 * 
 * This file implements an IntentFilter for matching and filtering intents.
 */

import { Intent } from './intent';

/**
 * IntentFilter for intent routing
 * 
 * An IntentFilter declares what types of intents a component
 * can handle, based on action, categories, and data.
 */
export class IntentFilter {
    /**
     * Actions this filter accepts
     */
    private actions: Set<string>;

    /**
     * Categories this filter requires
     */
    private categories: Set<string>;

    /**
     * Data types this filter accepts (MIME types)
     */
    private dataTypes: Set<string>;

    /**
     * Priority of this filter (higher = more priority)
     */
    priority: number;

    /**
     * Create a new intent filter
     * 
     * @param priority Optional priority (higher = more priority)
     */
    constructor(priority: number = 0) {
        this.actions = new Set();
        this.categories = new Set();
        this.dataTypes = new Set();
        this.priority = priority;
    }

    /**
     * Add an action to this filter
     * 
     * @param action Action to accept
     * @returns this filter for chaining
     */
    addAction(action: string): IntentFilter {
        this.actions.add(action);
        return this;
    }

    /**
     * Add a category to this filter
     * 
     * @param category Category to require
     * @returns this filter for chaining
     */
    addCategory(category: string): IntentFilter {
        this.categories.add(category);
        return this;
    }

    /**
     * Add a data type to this filter (MIME type)
     * 
     * @param type MIME type to accept
     * @returns this filter for chaining
     */
    addDataType(type: string): IntentFilter {
        this.dataTypes.add(type);
        return this;
    }

    /**
     * Check if this filter matches an intent
     * 
     * @param intent Intent to check
     * @returns Whether the intent matches
     */
    matches(intent: Intent): boolean {
        // Action must match
        if (this.actions.size > 0 && !this.actions.has(intent.action)) {
            return false;
        }

        // All required categories must be present
        if (this.categories.size > 0) {
            for (const category of this.categories) {
                if (!intent.hasCategory(category)) {
                    return false;
                }
            }
        }

        // If data types are specified, the intent must have a matching type
        if (this.dataTypes.size > 0 && intent.type) {
            // Check for direct matches
            if (this.dataTypes.has(intent.type)) {
                return true;
            }

            // Check for wildcard matches (e.g., "image/*" matches "image/jpeg")
            for (const dataType of this.dataTypes) {
                if (dataType.endsWith('/*')) {
                    const prefix = dataType.substring(0, dataType.length - 2);
                    if (intent.type.startsWith(prefix + '/')) {
                        return true;
                    }
                }
            }

            return false;
        }

        return true;
    }

    /**
     * Get all actions this filter accepts
     */
    getActions(): string[] {
        return Array.from(this.actions);
    }

    /**
     * Get all categories this filter requires
     */
    getCategories(): string[] {
        return Array.from(this.categories);
    }

    /**
     * Get all data types this filter accepts
     */
    getDataTypes(): string[] {
        return Array.from(this.dataTypes);
    }
} 