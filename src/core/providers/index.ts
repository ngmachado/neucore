/**
 * Model Providers Module for NeuroCore
 * 
 * Exports provider interfaces, implementations, and factory functions.
 */

// Export provider interface
export * from './modelProvider';

// Export concrete provider implementations
export * from './anthropicProvider';

// Export provider factory
import {
    IModelProvider,
    CompletionParams,
    CompletionResponse
} from './modelProvider';
import { AnthropicProvider, AnthropicConfig } from './anthropicProvider';

/**
 * Provider factory configuration
 */
export interface ProviderFactoryConfig {
    /**
     * Anthropic provider configuration
     */
    anthropic?: AnthropicConfig;

    /**
     * OpenAI provider configuration (when implemented)
     */
    openai?: {
        apiKey: string;
        organization?: string;
        defaultModel?: string;
    };

    /**
     * Default provider to use
     */
    defaultProvider?: 'anthropic' | 'openai';
}

/**
 * Factory for creating model providers
 */
export class ProviderFactory {
    private config: ProviderFactoryConfig;
    private providers: Map<string, IModelProvider> = new Map();

    /**
     * Create a new provider factory
     */
    constructor(config: ProviderFactoryConfig) {
        this.config = config;

        // Initialize providers
        this.initializeProviders();
    }

    /**
     * Initialize configured providers
     */
    private initializeProviders(): void {
        // Initialize Anthropic if configured
        if (this.config.anthropic) {
            this.providers.set('anthropic', new AnthropicProvider(this.config.anthropic));
        }

        // OpenAI will be added when implemented
    }

    /**
     * Get a provider instance
     */
    getProvider(name?: string): IModelProvider {
        let providerName = name;

        // If no name is specified, use default
        if (!providerName) {
            providerName = this.config.defaultProvider ||
                (this.config.anthropic ? 'anthropic' : undefined);
        }

        // No provider available
        if (!providerName || !this.providers.has(providerName)) {
            throw new Error(`Provider not available: ${providerName || 'default'}`);
        }

        return this.providers.get(providerName)!;
    }

    /**
     * Generate a completion using the specified or default provider
     */
    async generateCompletion(
        params: CompletionParams,
        providerName?: string
    ): Promise<CompletionResponse> {
        const provider = this.getProvider(providerName);
        return provider.generateCompletion(params);
    }

    /**
     * Generate an embedding using the specified or default provider
     */
    async generateEmbedding(
        text: string | string[],
        model?: string,
        providerName?: string
    ): Promise<number[][]> {
        const provider = this.getProvider(providerName);

        const response = await provider.generateEmbeddings({
            text,
            model
        });

        return response.embeddings;
    }

    /**
     * Get a list of all available providers
     */
    getAvailableProviders(): string[] {
        return Array.from(this.providers.keys());
    }
}

/**
 * Create a provider factory with the given configuration
 */
export function createProviderFactory(config: ProviderFactoryConfig): ProviderFactory {
    return new ProviderFactory(config);
} 