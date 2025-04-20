export class ProviderManager {
    private availableProviders: string[] = [];

    async initialize(): Promise<void> {
        // Simulate providers initialization
        // In a real implementation, this would connect to actual AI providers
        this.availableProviders = ['openai', 'anthropic'];
    }

    async shutdown(): Promise<void> {
        // Shutdown providers
        this.availableProviders = [];
    }

    /**
     * Get a list of available providers that have been initialized
     */
    getAvailableProviders(): string[] {
        return [...this.availableProviders];
    }
} 