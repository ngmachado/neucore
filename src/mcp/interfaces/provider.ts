/**
 * MCP Provider Interface
 */

import { UUID } from '../../types';

/**
 * Provider configuration
 */
export interface ProviderConfig {
    id: UUID;
    name: string;
    type: string;
    config: Record<string, any>;
}

/**
 * Provider interface
 */
export interface IProvider {
    /**
     * Provider ID
     */
    id: UUID;

    /**
     * Provider name
     */
    name: string;

    /**
     * Provider type
     */
    type: string;

    /**
     * Initialize the provider
     */
    initialize(config: ProviderConfig): Promise<void>;

    /**
     * Validate provider configuration
     */
    validateConfig(config: ProviderConfig): Promise<boolean>;

    /**
     * Get provider status
     */
    getStatus(): Promise<{
        status: 'ready' | 'error' | 'initializing';
        error?: string;
    }>;

    /**
     * Cleanup provider resources
     */
    cleanup(): Promise<void>;
} 