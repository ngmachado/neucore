import { ITemplateDataProvider, ITemplateDataRegistry, TemplateContext } from './dataProvider';
import { Template } from './templateRegistry';

/**
 * Configuration options for the template engine
 */
export interface TemplateEngineOptions {
    /**
     * Opening delimiter for placeholders
     */
    openDelimiter?: string;

    /**
     * Closing delimiter for placeholders
     */
    closeDelimiter?: string;

    /**
     * Whether to throw errors on missing values
     */
    throwOnMissing?: boolean;

    /**
     * Default value for missing placeholders
     */
    defaultValue?: string;

    /**
     * Logger instance
     */
    logger: any;
}

/**
 * Data registry implementation
 */
export class TemplateDataRegistry implements ITemplateDataRegistry {
    private providers: Map<string, ITemplateDataProvider> = new Map();
    private logger: any;

    constructor(options: { logger: any }) {
        this.logger = options.logger;
    }

    public registerProvider(provider: ITemplateDataProvider): void {
        const namespace = provider.getNamespace();
        this.providers.set(namespace, provider);
        this.logger.debug(`Registered template data provider for namespace: ${namespace}`);
    }

    public getProvider(namespace: string): ITemplateDataProvider | undefined {
        return this.providers.get(namespace);
    }

    public getAllProviders(): ITemplateDataProvider[] {
        return Array.from(this.providers.values())
            .sort((a, b) => (b.getPriority?.() || 0) - (a.getPriority?.() || 0));
    }

    public removeProvider(namespace: string): boolean {
        return this.providers.delete(namespace);
    }
}

/**
 * Template engine for parsing and rendering templates
 */
export class TemplateEngine {
    private dataRegistry: ITemplateDataRegistry;
    private options: TemplateEngineOptions;

    constructor(dataRegistry: ITemplateDataRegistry, options: TemplateEngineOptions) {
        this.dataRegistry = dataRegistry;
        this.options = {
            openDelimiter: '{{',
            closeDelimiter: '}}',
            throwOnMissing: false,
            defaultValue: '',
            ...options
        };
    }

    /**
     * Render a template with the given context
     * @param template The template to render
     * @param context Context containing variables and request data
     * @returns The rendered template
     */
    public render(template: Template | string, context: TemplateContext): string {
        const templateContent = typeof template === 'string' ? template : template.content;
        return this.renderString(templateContent, context);
    }

    /**
     * Render a template string with the given context
     * @param templateString The template string to render
     * @param context Context containing variables and request data
     * @returns The rendered string
     */
    public renderString(templateString: string, context: TemplateContext): string {
        if (!templateString) {
            return '';
        }

        const { openDelimiter, closeDelimiter } = this.options;
        const placeholderRegex = new RegExp(`${openDelimiter}\\s*([\\w\\.]+)\\s*${closeDelimiter}`, 'g');

        // Collect all variables from providers
        const variables = this.collectVariables(context);

        // Add any explicit variables from the context
        if (context.variables) {
            Object.assign(variables, context.variables);
        }

        // Replace placeholders
        return templateString.replace(placeholderRegex, (match, path) => {
            return this.resolvePath(path, variables);
        });
    }

    /**
     * Collect variables from all registered providers
     * @param context The template context
     * @returns Object containing all variables
     */
    private collectVariables(context: TemplateContext): Record<string, any> {
        const variables: Record<string, any> = {};

        // Get all providers in priority order
        const providers = this.dataRegistry.getAllProviders();

        // Collect variables from each provider
        for (const provider of providers) {
            try {
                const namespace = provider.getNamespace();
                const providerVars = provider.getVariables(context.requestContext);

                if (providerVars && typeof providerVars === 'object') {
                    variables[namespace] = providerVars;
                }
            } catch (error) {
                this.options.logger.error(`Error collecting variables from provider ${provider.getNamespace()}:`, error);
            }
        }

        // Add system variables
        variables.system = {
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString(),
            timestamp: new Date().toISOString(),
            datetime: new Date().toString()
        };

        return variables;
    }

    /**
     * Resolve a path within an object (e.g., "user.profile.name")
     * @param path Dot-notation path
     * @param obj Object to traverse
     * @returns Resolved value or default/error
     */
    private resolvePath(path: string, obj: Record<string, any>): string {
        try {
            const parts = path.split('.');
            let value = obj;

            for (const part of parts) {
                if (value === undefined || value === null) {
                    if (this.options.throwOnMissing) {
                        throw new Error(`Missing value for path: ${path}`);
                    }
                    return this.options.defaultValue || '';
                }

                value = value[part];
            }

            if (value === undefined || value === null) {
                if (this.options.throwOnMissing) {
                    throw new Error(`Missing value for path: ${path}`);
                }
                return this.options.defaultValue || '';
            }

            return String(value);
        } catch (error) {
            this.options.logger.error(`Error resolving path ${path}:`, error);

            if (this.options.throwOnMissing) {
                throw error;
            }

            return this.options.defaultValue || '';
        }
    }
} 