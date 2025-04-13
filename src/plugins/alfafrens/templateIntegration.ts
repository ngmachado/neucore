import { Intent } from '../../mcp/intent';
import { MCP } from '../../mcp/mcp';
import { MessageDataProvider } from './messageDataProvider';
import { BotDataProvider } from './botDataProvider';
import { ALFAFRENS_TEMPLATES } from './templates';
import { ResponseFormatter } from './responseFormatter';
import { AlfaFrensMessage } from './types'; // Import from the types file instead

/**
 * Helper class to integrate the template system into the Alfafrens plugin
 */
export class TemplateIntegration {
    private mcp: MCP;
    private logger: any;
    private botConfig: any;
    private messageProvider: MessageDataProvider;
    private botProvider: BotDataProvider;
    private templatesRegistered: boolean = false;

    /**
     * Initialize the template integration
     */
    constructor(options: {
        mcp: MCP;
        logger: any;
        botConfig: any;
    }) {
        this.mcp = options.mcp;
        this.logger = options.logger;
        this.botConfig = options.botConfig;

        // Create providers
        this.messageProvider = new MessageDataProvider();
        this.botProvider = new BotDataProvider(this.botConfig);
    }

    /**
     * Register templates and providers with the template system
     */
    public async initialize(): Promise<void> {
        // Register data providers
        await this.registerDataProviders();

        // Register templates
        await this.registerTemplates();

        this.templatesRegistered = true;
        this.logger.info('Template integration initialized');
    }

    /**
     * Register data providers with the template system
     */
    private async registerDataProviders(): Promise<void> {
        try {
            // Register message provider
            const messageProviderIntent = new Intent('template:provider:register', {
                provider: this.messageProvider
            });

            const messageResult = await this.mcp.executeIntent(messageProviderIntent);

            if (messageResult.success) {
                this.logger.debug('Registered message data provider');
            } else {
                this.logger.error('Failed to register message provider:', messageResult.error);
            }

            // Register bot provider
            const botProviderIntent = new Intent('template:provider:register', {
                provider: this.botProvider
            });

            const botResult = await this.mcp.executeIntent(botProviderIntent);

            if (botResult.success) {
                this.logger.debug('Registered bot data provider');
            } else {
                this.logger.error('Failed to register bot provider:', botResult.error);
            }
        } catch (error) {
            this.logger.error('Error registering data providers:', error);
        }
    }

    /**
     * Register templates with the template system
     */
    private async registerTemplates(): Promise<void> {
        try {
            const registerIntent = new Intent('template:register', {
                templates: ALFAFRENS_TEMPLATES
            });

            const result = await this.mcp.executeIntent(registerIntent);

            if (result.success) {
                this.logger.debug(`Registered ${result.data.count} Alfafrens templates`);
            } else {
                this.logger.error('Failed to register templates:', result.error);
            }
        } catch (error) {
            this.logger.error('Error registering templates:', error);
        }
    }

    /**
     * Set character information for the bot provider
     */
    public setCharacter(characterId: string, traits: Record<string, any>): void {
        this.botProvider.setCharacter(characterId, traits);
    }

    /**
     * Format and process a response using templates
     * 
     * @param message The message being responded to
     * @param rawResponse The raw AI-generated response
     * @param templateUsage Optional template usage hint
     * @returns Formatted response
     */
    public async formatResponse(
        message: AlfaFrensMessage,
        rawResponse: string,
        templateUsage: string = 'standard'
    ): Promise<string> {
        if (!this.templatesRegistered) {
            await this.initialize();
        }

        try {
            // First format the raw response
            const formattedContent = ResponseFormatter.format(rawResponse);

            // Find best template based on usage
            const templateIntent = new Intent('template:get', {
                options: {
                    category: 'response',
                    usage: templateUsage,
                    pluginId: 'alfafrens-plugin'
                }
            });

            const templateResult = await this.mcp.executeIntent(templateIntent);

            if (!templateResult.success || !templateResult.data.templates || templateResult.data.templates.length === 0) {
                this.logger.warn(`No template found for usage: ${templateUsage}, falling back to raw response`);
                return formattedContent;
            }

            // Get the best matching template
            const template = templateResult.data.templates[0];

            // Create context for template rendering
            const renderIntent = new Intent('template:render', {
                templateId: template.id,
                variables: {
                    message: {
                        ...this.messageProvider.getVariables({ message }),
                        content: formattedContent
                    }
                }
            });

            const renderResult = await this.mcp.executeIntent(renderIntent);

            if (renderResult.success) {
                return renderResult.data.rendered;
            } else {
                this.logger.error('Error rendering template:', renderResult.error);
                return formattedContent;
            }
        } catch (error) {
            this.logger.error('Error formatting response:', error);
            return rawResponse;
        }
    }
} 