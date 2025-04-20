import { IPlugin, PluginResult, RequestContext } from '../mcp/interfaces/plugin';
import { Intent } from '../mcp/intent';
import { UUID } from '../types';
import {
    createTemplateSystem,
    ITemplateRegistry,
    ITemplateDataRegistry,
    TemplateEngine,
    Template,
    TemplateContext
} from '../core/templates';

/**
 * Template plugin that provides template rendering capabilities
 */
export class TemplatePlugin implements IPlugin {
    private initialized: boolean = false;
    private logger: any;
    private templateRegistry: ITemplateRegistry;
    private dataRegistry: ITemplateDataRegistry;
    private templateEngine: TemplateEngine;

    // Add document configuration for AI context
    public documentConfig = {
        documents: [
            {
                path: 'src/plugins/templatePlugin.md',
                type: 'markdown',
                fragmentSize: 800,
                fragmentOverlap: 150,
                metadata: {
                    title: 'Template Plugin Documentation',
                    category: 'plugin-docs',
                    description: 'Documentation for the Template Plugin'
                }
            }
        ],
        alwaysInclude: true
    };

    constructor(options: { logger: any }) {
        this.logger = options.logger;

        // Create the template system
        const system = createTemplateSystem(this.logger);
        this.templateRegistry = system.templateRegistry;
        this.dataRegistry = system.dataRegistry;
        this.templateEngine = system.templateEngine;
    }

    /**
     * Get the ID of this plugin
     */
    public getId(): UUID {
        return 'template-plugin';
    }

    /**
     * Get the name of this plugin
     */
    public getName(): string {
        return 'Template Plugin';
    }

    /**
     * Check if this plugin can handle an intent
     */
    public canHandle(intent: Intent): boolean {
        return intent.action.startsWith('template:');
    }

    /**
     * Get the list of intents this plugin supports
     */
    public supportedIntents(): string[] {
        return [
            'template:render',
            'template:register',
            'template:get',
            'template:provider:register'
        ];
    }

    /**
     * Initialize the plugin
     */
    public async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        this.logger.info('Initializing TemplatePlugin');

        // Register built-in templates
        this.registerBuiltInTemplates();

        this.initialized = true;
    }

    /**
     * Shutdown the plugin
     */
    public async shutdown(): Promise<void> {
        this.logger.info('Shutting down TemplatePlugin');
        this.initialized = false;
    }

    /**
     * Execute an intent
     */
    public async execute(intent: Intent, context: RequestContext): Promise<PluginResult> {
        if (!this.initialized) {
            return {
                success: false,
                error: 'Plugin not initialized'
            };
        }

        try {
            switch (intent.action) {
                case 'template:render':
                    return this.handleRender(intent.data, context);
                case 'template:register':
                    return this.handleRegister(intent.data, context);
                case 'template:get':
                    return this.handleGet(intent.data, context);
                case 'template:provider:register':
                    return this.handleRegisterProvider(intent.data, context);
                default:
                    return {
                        success: false,
                        error: `Unsupported intent: ${intent.action}`
                    };
            }
        } catch (error) {
            this.logger.error(`Error executing intent ${intent.action}:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Handle template rendering
     */
    private handleRender(data: any, context: RequestContext): PluginResult {
        const { template, templateId, variables } = data || {};

        if (!template && !templateId) {
            return {
                success: false,
                error: 'Either template content or templateId is required'
            };
        }

        try {
            // Determine the template to use
            let templateToRender: Template | string;

            if (templateId) {
                const registeredTemplate = this.templateRegistry.getTemplateById(templateId);

                if (!registeredTemplate) {
                    return {
                        success: false,
                        error: `Template with ID ${templateId} not found`
                    };
                }

                templateToRender = registeredTemplate;
            } else {
                templateToRender = template;
            }

            // Create template context
            const templateContext: TemplateContext = {
                requestContext: context,
                variables: variables || {}
            };

            // Render the template
            const rendered = this.templateEngine.render(templateToRender, templateContext);

            return {
                success: true,
                data: {
                    rendered,
                    templateId: typeof templateToRender === 'object' ? templateToRender.id : undefined
                }
            };
        } catch (error) {
            this.logger.error('Error rendering template:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Handle template registration
     */
    private handleRegister(data: any, context: RequestContext): PluginResult {
        const { template, templates } = data || {};

        if (!template && (!templates || !Array.isArray(templates))) {
            return {
                success: false,
                error: 'Either a single template or an array of templates is required'
            };
        }

        try {
            if (template) {
                // Register single template
                const id = this.templateRegistry.registerTemplate(template);

                return {
                    success: true,
                    data: {
                        id,
                        message: `Template registered successfully with ID: ${id}`
                    }
                };
            } else {
                // Register multiple templates
                const ids = this.templateRegistry.registerTemplates(templates);

                return {
                    success: true,
                    data: {
                        ids,
                        count: ids.length,
                        message: `${ids.length} templates registered successfully`
                    }
                };
            }
        } catch (error) {
            this.logger.error('Error registering template(s):', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Handle template retrieval
     */
    private handleGet(data: any, context: RequestContext): PluginResult {
        const { id, options } = data || {};

        if (id) {
            // Get template by ID
            const template = this.templateRegistry.getTemplateById(id);

            if (!template) {
                return {
                    success: false,
                    error: `Template with ID ${id} not found`
                };
            }

            return {
                success: true,
                data: {
                    template
                }
            };
        } else if (options) {
            // Find templates by options
            const templates = this.templateRegistry.findTemplates(options);

            return {
                success: true,
                data: {
                    templates,
                    count: templates.length
                }
            };
        } else {
            return {
                success: false,
                error: 'Either id or options parameter is required'
            };
        }
    }

    /**
     * Handle data provider registration
     */
    private handleRegisterProvider(data: any, context: RequestContext): PluginResult {
        const { provider } = data || {};

        if (!provider || typeof provider.getNamespace !== 'function') {
            return {
                success: false,
                error: 'Valid data provider is required'
            };
        }

        try {
            this.dataRegistry.registerProvider(provider);

            return {
                success: true,
                data: {
                    namespace: provider.getNamespace(),
                    message: `Provider for namespace '${provider.getNamespace()}' registered successfully`
                }
            };
        } catch (error) {
            this.logger.error('Error registering data provider:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Register built-in templates
     */
    private registerBuiltInTemplates(): void {
        const templates: Template[] = [
            {
                id: 'system:response:standard',
                category: 'response',
                content: '{{message.content}}',
                metadata: {
                    usage: 'standard',
                    priority: 10,
                    pluginId: this.getId()
                }
            },
            {
                id: 'system:response:greeting',
                category: 'response',
                content: 'Hello {{message.username}}! {{message.content}}',
                metadata: {
                    usage: 'greeting',
                    priority: 10,
                    pluginId: this.getId()
                }
            },
            {
                id: 'system:response:formatted',
                category: 'response',
                content: '{{message.content}}',
                metadata: {
                    usage: 'formatted',
                    priority: 10,
                    pluginId: this.getId()
                }
            }
        ];

        this.templateRegistry.registerTemplates(templates);
        this.logger.debug(`Registered ${templates.length} built-in templates`);
    }
} 