/**
 * Provider registry for MCP adapters
 */

import { ProviderAdapter } from './provider';
import { IPlugin } from '../interfaces/plugin';
import { getLogger } from '../../core/logging';

const logger = getLogger('provider-registry');

/**
 * Registry for provider adapters
 * Manages registration and retrieval of provider adapters
 */
export class ProviderRegistry {
    private adapters = new Map<string, ProviderAdapter>();

    /**
     * Register a provider adapter
     * @param adapter The adapter to register
     */
    registerAdapter(adapter: ProviderAdapter): void {
        const name = adapter.getProviderName();

        if (this.adapters.has(name)) {
            logger.warn(`Provider adapter for '${name}' already registered. Overwriting.`);
        }

        this.adapters.set(name, adapter);
        logger.debug(`Registered provider adapter: ${name}`);
    }

    /**
     * Get an adapter by provider name
     * @param name Provider name
     * @returns The provider adapter or undefined if not found
     */
    getAdapter(name: string): ProviderAdapter | undefined {
        return this.adapters.get(name);
    }

    /**
     * Check if an adapter is registered
     * @param name Provider name
     * @returns Whether the adapter is registered
     */
    hasAdapter(name: string): boolean {
        return this.adapters.has(name);
    }

    /**
     * Get all registered adapters
     * @returns Array of registered adapters
     */
    getAdapters(): ProviderAdapter[] {
        return Array.from(this.adapters.values());
    }

    /**
     * Get names of all registered adapters
     * @returns Array of provider names
     */
    getProviderNames(): string[] {
        return Array.from(this.adapters.keys());
    }

    /**
     * Remove an adapter
     * @param name Provider name
     * @returns Whether the adapter was removed
     */
    removeAdapter(name: string): boolean {
        const result = this.adapters.delete(name);
        if (result) {
            logger.debug(`Removed provider adapter: ${name}`);
        }
        return result;
    }

    /**
     * Clear all adapters
     */
    clear(): void {
        this.adapters.clear();
        logger.debug('Cleared all provider adapters');
    }
} 