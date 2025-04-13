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
 * Intent definition object
 */
export interface IntentDefinition {
    action: string;
    data?: Record<string, any>;
    categories?: string[];
    flags?: number;
    type?: string;
}

/**
 * Intent class for MCP
 */
export class Intent {
    /**
     * Action to perform
     */
    public readonly action: string;

    /**
     * Data for the intent
     */
    public readonly data: Record<string, any>;

    /**
     * Categories for the intent
     */
    private categories: Set<string> = new Set();

    /**
     * Extra data for the intent
     */
    private extras: Map<string, any> = new Map();

    /**
     * Intent flags
     */
    public flags: number = 0;

    /**
     * Intent type (optional)
     */
    public type?: string;

    /**
     * Create a new intent
     * @param actionOrDefinition Action to perform or intent definition object
     * @param data Data for the intent (if using string action)
     */
    constructor(actionOrDefinition: string | IntentDefinition, data: Record<string, any> = {}) {
        if (typeof actionOrDefinition === 'string') {
            this.action = actionOrDefinition;
            this.data = data;
        } else {
            this.action = actionOrDefinition.action;
            this.data = actionOrDefinition.data || {};

            // Set optional properties from definition
            if (actionOrDefinition.categories) {
                actionOrDefinition.categories.forEach(category => this.addCategory(category));
            }

            if (actionOrDefinition.flags !== undefined) {
                this.flags = actionOrDefinition.flags;
            }

            if (actionOrDefinition.type) {
                this.type = actionOrDefinition.type;
            }
        }
    }

    /**
     * Add a category to the intent
     * @param category Category to add
     * @returns This intent for chaining
     */
    public addCategory(category: string): Intent {
        this.categories.add(category);
        return this;
    }

    /**
     * Check if the intent has a category
     * @param category Category to check
     * @returns Whether the intent has the category
     */
    public hasCategory(category: string): boolean {
        return this.categories.has(category);
    }

    /**
     * Get all categories
     * @returns Array of categories
     */
    public getCategories(): string[] {
        return Array.from(this.categories);
    }

    /**
     * Set flags on this intent
     * 
     * @param flags Flags to set
     * @returns this intent for chaining
     */
    setFlags(flags: number): Intent {
        this.flags = flags;
        return this;
    }

    /**
     * Put extra data into the intent
     * @param key Key for the data
     * @param value Value to store
     * @returns This intent for chaining
     */
    public putExtra(key: string, value: any): Intent {
        this.extras.set(key, value);
        return this;
    }

    /**
     * Get extra data from the intent
     * @param key Key for the data
     * @param defaultValue Default value if not found
     * @returns The value or default
     */
    public getExtra<T>(key: string, defaultValue?: T): T | undefined {
        return this.extras.has(key) ? this.extras.get(key) as T : defaultValue;
    }

    /**
     * Check if the intent has extra data
     * @param key Key for the data
     * @returns Whether the intent has the data
     */
    public hasExtra(key: string): boolean {
        return this.extras.has(key);
    }

    /**
     * Get all extras as an object
     * @returns Object of all extras
     */
    public getExtras(): Record<string, any> {
        const result: Record<string, any> = {};
        for (const [key, value] of this.extras.entries()) {
            result[key] = value;
        }
        return result;
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