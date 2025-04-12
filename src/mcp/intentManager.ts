/**
 * MCP Intent Manager
 */

import { UUID } from '../types';
import { Intent } from './intent';
import { IPlugin } from './interfaces/plugin';
import { generateUUID } from '../utils';

/**
 * Intent manager configuration
 */
export interface IntentManagerConfig {
    maxIntentHistory?: number;
    intentTimeout?: number;
    defaultHandler?: IPlugin;
}

/**
 * Intent manager class
 */
export class IntentManager {
    private intents: Map<UUID, Intent>;
    private config: IntentManagerConfig;

    constructor(config: IntentManagerConfig = {}) {
        this.intents = new Map();
        this.config = {
            maxIntentHistory: 100,
            intentTimeout: 30000,
            ...config
        };
    }

    /**
     * Register a new intent
     */
    public registerIntent(intent: Intent): UUID {
        const id = generateUUID();
        intent.putExtra('id', id);
        this.intents.set(id, intent);
        return id;
    }

    /**
     * Get intent by ID
     */
    public getIntent(id: UUID): Intent | undefined {
        return this.intents.get(id);
    }

    /**
     * Remove intent by ID
     */
    public removeIntent(id: UUID): boolean {
        return this.intents.delete(id);
    }

    /**
     * Get all registered intents
     */
    public getAllIntents(): Intent[] {
        return Array.from(this.intents.values());
    }

    /**
     * Clear all intents
     */
    public clearIntents(): void {
        this.intents.clear();
    }
} 