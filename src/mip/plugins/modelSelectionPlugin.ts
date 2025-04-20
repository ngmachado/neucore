import { IPlugin, PluginResult, RequestContext } from '../../mcp/interfaces/plugin';
import { Intent } from '../../mcp/intent';
import { MIPIntent } from '../interfaces/intent';
import { ModelSelectionHandler } from '../handlers/modelSelectionHandler';
import { ModelSelectionCriteria, ModelSelectionResult } from '../types/modelSelection';
import { ModelRegistry } from '../registry/modelRegistry';
import { UUID } from '../../types';

/**
 * Plugin that handles model selection intents
 */
export class ModelSelectionPlugin implements IPlugin {
    private initialized: boolean = false;
    private handler: ModelSelectionHandler;
    private logger: any;
    private modelRegistry: ModelRegistry;

    constructor(options: {
        logger: any;
        modelRegistry: ModelRegistry;
    }) {
        this.logger = options.logger;
        this.modelRegistry = options.modelRegistry;
        this.handler = new ModelSelectionHandler(this.modelRegistry);
    }

    /**
     * Get the ID of this plugin
     */
    public getId(): UUID {
        return 'model-selection-plugin';
    }

    /**
     * Get the name of this plugin
     */
    public getName(): string {
        return 'Model Selection Plugin';
    }

    /**
     * Check if this plugin can handle an intent
     */
    public canHandle(intent: Intent | MIPIntent | { action: string }): boolean {
        return intent.action === 'model-selection';
    }

    /**
     * Get the list of intents this plugin supports
     */
    public supportedIntents(): string[] {
        return ['model-selection'];
    }

    /**
     * Initialize the plugin
     */
    public async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        this.logger.info('Initializing ModelSelectionPlugin');
        this.initialized = true;
    }

    /**
     * Shutdown the plugin
     */
    public async shutdown(): Promise<void> {
        this.logger.info('Shutting down ModelSelectionPlugin');
        this.initialized = false;
    }

    /**
     * Execute an intent
     */
    public async execute(intent: { action: string, data: any }, context: RequestContext): Promise<PluginResult> {
        if (!this.initialized) {
            return {
                success: false,
                error: 'Plugin not initialized'
            };
        }

        try {
            if (intent.action === 'model-selection') {
                const criteria = intent.data as ModelSelectionCriteria;

                // Basic validation - ensure we have criteria data
                if (!criteria) {
                    return {
                        success: false,
                        error: 'Missing criteria data for model selection'
                    };
                }

                // Validate required taskType field
                if (!criteria.taskType) {
                    return {
                        success: false,
                        error: 'Missing required criteria: taskType'
                    };
                }

                // Additional validation will be done in the handler
                try {
                    const result = this.handler.selectModel(criteria);
                    return {
                        success: true,
                        data: result
                    };
                } catch (validationError) {
                    // Detailed error from the handler's validation
                    return {
                        success: false,
                        error: validationError instanceof Error ? validationError.message : String(validationError)
                    };
                }
            }

            return {
                success: false,
                error: `Unsupported intent: ${intent.action}`
            };
        } catch (error) {
            this.logger.error(`Error executing intent ${intent.action}:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
} 