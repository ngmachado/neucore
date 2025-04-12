/**
 * Modern Intent System for NeuroCore
 * 
 * This file implements an Intent system with actions,
 * categories, data, and flags.
 */

/**
 * Flag constants for Intent behavior
 */
export enum IntentFlags {
    NONE = 0,
    BACKGROUND = 1 << 0,
    PRIVILEGED = 1 << 1,
    IMMEDIATE = 1 << 2,
    REQUIRES_AUTH = 1 << 3,
    SYSTEM = 1 << 4,
}

/**
 * Intent implementation for message routing
 */
export class Intent {
    /**
     * The action this intent requests
     * Format typically uses namespaces like 'anthropic:generate'
     */
    action: string;

    /**
     * Intent categories for filtering
     */
    categories: Set<string>;

    /**
     * Intent data payload
     */
    data?: any;

    /**
     * Intent flags for controlling behavior
     */
    flags: number;

    /**
     * Optional MIME type
     */
    type?: string;

    /**
     * Extra data map for additional parameters
     */
    extras: Map<string, any>;

    /**
     * Create a new Intent
     * 
     * @param action Action name (required)
     * @param data Optional data payload
     */
    constructor(action: string, data?: any) {
        this.action = action;
        this.data = data;
        this.categories = new Set();
        this.flags = IntentFlags.NONE;
        this.extras = new Map();
    }

    /**
     * Add a category to this intent
     * 
     * @param category Category to add
     * @returns this intent for chaining
     */
    addCategory(category: string): Intent {
        this.categories.add(category);
        return this;
    }

    /**
     * Check if intent has a specific category
     * 
     * @param category Category to check
     * @returns Whether the category exists
     */
    hasCategory(category: string): boolean {
        return this.categories.has(category);
    }

    /**
     * Add a flag to this intent
     * 
     * @param flag Flag to add
     * @returns this intent for chaining
     */
    addFlag(flag: number): Intent {
        this.flags |= flag;
        return this;
    }

    /**
     * Check if intent has a specific flag
     * 
     * @param flag Flag to check
     * @returns Whether the flag is set
     */
    hasFlag(flag: number): boolean {
        return (this.flags & flag) === flag;
    }

    /**
     * Set the MIME type
     * 
     * @param type MIME type
     * @returns this intent for chaining
     */
    setType(type: string): Intent {
        this.type = type;
        return this;
    }

    /**
     * Add extra data to the intent
     * 
     * @param key Extra data key
     * @param value Extra data value
     * @returns this intent for chaining
     */
    putExtra(key: string, value: any): Intent {
        this.extras.set(key, value);
        return this;
    }

    /**
     * Get an extra value
     * 
     * @param key Extra data key
     * @param defaultValue Default value if not found
     * @returns The extra value or default
     */
    getExtra<T>(key: string, defaultValue?: T): T | undefined {
        return this.extras.has(key) ? this.extras.get(key) : defaultValue;
    }

    /**
     * Convert intent to a simple object for serialization
     */
    toJSON(): any {
        return {
            action: this.action,
            categories: Array.from(this.categories),
            data: this.data,
            flags: this.flags,
            type: this.type,
            extras: Object.fromEntries(this.extras)
        };
    }

    /**
     * Create an Intent from a plain object
     * 
     * @param obj Object with intent data
     * @returns A new Intent
     */
    static fromJSON(obj: any): Intent {
        const intent = new Intent(obj.action, obj.data);
        if (obj.categories) {
            obj.categories.forEach((category: string) => intent.addCategory(category));
        }
        intent.flags = obj.flags || IntentFlags.NONE;
        intent.type = obj.type;
        if (obj.extras) {
            Object.entries(obj.extras).forEach(([key, value]) => {
                intent.putExtra(key, value);
            });
        }
        return intent;
    }
} 