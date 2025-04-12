/**
 * Provider Manager for MCP
 */

import { UUID } from '../types';
import { IProvider, ProviderConfig } from './interfaces/provider';
import { generateUUID } from '../utils';

/**
 * Provider manager configuration
 */
export interface ProviderManagerConfig {
    maxProviders?: number;
    providerTimeout?: number;
}

/**
 * Provider manager class
 */
export class ProviderManager {
    private providers: Map<UUID, IProvider>;
    private config: ProviderManagerConfig;

    constructor(config: ProviderManagerConfig = {}) {
        this.providers = new Map();
        this.config = {
            maxProviders: 100,
            providerTimeout: 30000,
            ...config
        };
    }

    /**
     * Initialize provider manager
     */
    public async initialize(): Promise<void> {
        // Initialize all registered providers
        for (const provider of this.providers.values()) {
            await provider.initialize({
                id: provider.id,
                name: provider.name,
                type: provider.type,
                config: {}
            });
        }
    }

    /**
     * Register a provider
     */
    public registerProvider(provider: IProvider): UUID {
        const id = generateUUID();
        this.providers.set(id, provider);
        return id;
    }

    /**
     * Unregister a provider
     */
    public async unregisterProvider(providerId: UUID): Promise<boolean> {
        const provider = this.providers.get(providerId);
        if (provider) {
            await provider.cleanup();
        }
        return this.providers.delete(providerId);
    }

    /**
     * Get provider by ID
     */
    public getProvider(providerId: UUID): IProvider | undefined {
        return this.providers.get(providerId);
    }

    /**
     * Get all registered providers
     */
    public getAllProviders(): IProvider[] {
        return Array.from(this.providers.values());
    }

    /**
     * Get providers by type
     */
    public getProvidersByType(type: string): IProvider[] {
        return Array.from(this.providers.values()).filter(
            provider => provider.type === type
        );
    }

    /**
     * Shutdown provider manager
     */
    public async shutdown(): Promise<void> {
        for (const provider of this.providers.values()) {
            await provider.cleanup();
        }
        this.providers.clear();
    }
} 