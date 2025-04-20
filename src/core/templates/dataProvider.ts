/**
 * Interface for template data providers
 * These providers inject variables into templates based on their namespace
 */
export interface ITemplateDataProvider {
    /**
     * Get the namespace this provider operates in
     * @returns The namespace string (e.g., 'message', 'user', 'bot')
     */
    getNamespace(): string;

    /**
     * Get all variables this provider can supply for the given context
     * @param context The request context to extract variables from
     * @returns Object mapping variable names to their values
     */
    getVariables(context: any): Record<string, any>;

    /**
     * Get priority order for this provider (higher numbers get processed first)
     * @returns Priority number (default 0)
     */
    getPriority?(): number;
}

/**
 * Registry for template data providers
 */
export interface ITemplateDataRegistry {
    /**
     * Register a data provider
     * @param provider The data provider to register
     */
    registerProvider(provider: ITemplateDataProvider): void;

    /**
     * Get a data provider by namespace
     * @param namespace The namespace to look up
     * @returns The data provider for the namespace or undefined
     */
    getProvider(namespace: string): ITemplateDataProvider | undefined;

    /**
     * Get all registered providers
     * @returns Array of all registered providers
     */
    getAllProviders(): ITemplateDataProvider[];

    /**
     * Remove a provider by namespace
     * @param namespace The namespace to remove
     * @returns true if provider was removed, false if not found
     */
    removeProvider(namespace: string): boolean;
}

/**
 * Context for template rendering
 */
export interface TemplateContext {
    /**
     * The original request context
     */
    requestContext: any;

    /**
     * Additional variables to include in template rendering
     */
    variables?: Record<string, any>;
} 