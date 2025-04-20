import {
    AIModel,
    ModelProvider,
    ModelSelectionCriteria,
    TaskType,
    ClassificationType,
    GenerationType,
    EmbeddingType,
    IModelRegistry
} from '../types/modelSelection';

/**
 * Implementation of the model registry
 */
export class ModelRegistry implements IModelRegistry {
    private models: Map<string, AIModel> = new Map();
    private availableProviders: Set<ModelProvider> = new Set();

    constructor() {
        // Register built-in models on initialization
        this.registerBuiltInModels();
    }

    /**
     * Set available providers that are initialized in the system
     * @param providers List of available provider IDs
     */
    public setAvailableProviders(providers: ModelProvider[]): void {
        this.availableProviders.clear();
        providers.forEach(provider => this.availableProviders.add(provider));
    }

    /**
     * Check if a provider is available
     * @param provider Provider to check
     */
    public isProviderAvailable(provider: ModelProvider): boolean {
        return this.availableProviders.size === 0 || this.availableProviders.has(provider);
    }

    /**
     * Register a new model in the registry
     */
    public registerModel(model: AIModel): void {
        if (this.models.has(model.id)) {
            throw new Error(`Model with ID ${model.id} already exists in the registry`);
        }

        this.models.set(model.id, model);
    }

    /**
     * Get a model by its ID
     */
    public getModelById(id: string): AIModel | undefined {
        return this.models.get(id);
    }

    /**
     * Find models that match given criteria
     */
    public findModels(criteria: ModelSelectionCriteria): AIModel[] {
        const result: AIModel[] = [];

        for (const model of this.models.values()) {
            if (!model.active) continue;

            // Skip models from unavailable providers
            if (!this.isProviderAvailable(model.provider)) continue;

            // Check task type match
            if (!model.capabilities.tasks.includes(criteria.taskType as TaskType)) {
                continue;
            }

            // Check specific requirements
            const specificReqs = criteria.specificRequirements;
            if (specificReqs) {
                // Classification type check
                if (specificReqs.classificationType &&
                    model.capabilities.classificationTypes &&
                    !model.capabilities.classificationTypes.includes(specificReqs.classificationType)) {
                    continue;
                }

                // Generation type check
                if (specificReqs.generationType &&
                    model.capabilities.generationTypes &&
                    !model.capabilities.generationTypes.includes(specificReqs.generationType)) {
                    continue;
                }

                // Embedding type check
                if (specificReqs.embeddingType &&
                    model.capabilities.embeddingTypes &&
                    !model.capabilities.embeddingTypes.includes(specificReqs.embeddingType)) {
                    continue;
                }

                // Dimensionality check
                if (specificReqs.dimensionality &&
                    model.capabilities.dimensionality &&
                    model.capabilities.dimensionality < specificReqs.dimensionality) {
                    continue;
                }
            }

            // Performance requirements check
            const perfReqs = criteria.performanceRequirements;
            if (perfReqs) {
                if (perfReqs.maxLatency !== undefined &&
                    model.performanceMetrics.latency > perfReqs.maxLatency) {
                    continue;
                }

                if (perfReqs.minQuality !== undefined &&
                    model.performanceMetrics.quality < perfReqs.minQuality) {
                    continue;
                }

                if (perfReqs.maxCost !== undefined &&
                    model.performanceMetrics.costPerToken * 1000 > perfReqs.maxCost) {
                    continue;
                }
            }

            // If we get here, the model matches all criteria
            result.push(model);
        }

        // Sort by quality (descending) and then by latency (ascending)
        return result.sort((a, b) => {
            // First by quality (higher is better)
            const qualityDiff = b.performanceMetrics.quality - a.performanceMetrics.quality;
            if (Math.abs(qualityDiff) > 0.01) return qualityDiff;

            // Then by latency (lower is better)
            return a.performanceMetrics.latency - b.performanceMetrics.latency;
        });
    }

    /**
     * Get all available models
     */
    public getAllModels(): AIModel[] {
        return Array.from(this.models.values())
            .filter(model => this.isProviderAvailable(model.provider));
    }

    /**
     * Get models for a specific provider
     */
    public getModelsByProvider(provider: ModelProvider): AIModel[] {
        if (!this.isProviderAvailable(provider)) {
            return [];
        }
        return Array.from(this.models.values()).filter(model => model.provider === provider);
    }

    /**
     * Register built-in models
     */
    private registerBuiltInModels(): void {
        // OpenAI models
        this.registerModel({
            id: 'gpt-4',
            name: 'GPT-4',
            provider: 'openai',
            version: '1.0',
            capabilities: {
                tasks: ['classification', 'generation'],
                classificationTypes: ['binary', 'multi-class'],
                generationTypes: ['short', 'long', 'creative', 'factual']
            },
            performanceMetrics: {
                latency: 1200,
                quality: 0.95,
                costPerToken: 0.00003,
                throughput: 2
            },
            contextWindow: 8192,
            active: true
        });

        this.registerModel({
            id: 'gpt-3.5-turbo',
            name: 'GPT-3.5 Turbo',
            provider: 'openai',
            version: '1.0',
            capabilities: {
                tasks: ['classification', 'generation'],
                classificationTypes: ['binary', 'multi-class'],
                generationTypes: ['short', 'long', 'creative', 'factual']
            },
            performanceMetrics: {
                latency: 500,
                quality: 0.85,
                costPerToken: 0.000002,
                throughput: 10
            },
            contextWindow: 4096,
            active: true
        });

        this.registerModel({
            id: 'text-embedding-ada-002',
            name: 'Text Embedding Ada 002',
            provider: 'openai',
            version: '1.0',
            capabilities: {
                tasks: ['embedding'],
                embeddingTypes: ['semantic', 'contextual'],
                dimensionality: 1536
            },
            performanceMetrics: {
                latency: 150,
                quality: 0.92,
                costPerToken: 0.0000001,
                throughput: 40
            },
            contextWindow: 8191,
            active: true
        });

        // Anthropic models
        this.registerModel({
            id: 'claude-2',
            name: 'Claude 2',
            provider: 'anthropic',
            version: '1.0',
            capabilities: {
                tasks: ['classification', 'generation'],
                classificationTypes: ['binary', 'multi-class'],
                generationTypes: ['short', 'long', 'creative', 'factual']
            },
            performanceMetrics: {
                latency: 1000,
                quality: 0.93,
                costPerToken: 0.000011,
                throughput: 5
            },
            contextWindow: 100000,
            active: true
        });

        // Cohere models
        this.registerModel({
            id: 'cohere-embed',
            name: 'Cohere Embed',
            provider: 'cohere',
            version: '1.0',
            capabilities: {
                tasks: ['embedding'],
                embeddingTypes: ['semantic'],
                dimensionality: 4096
            },
            performanceMetrics: {
                latency: 120,
                quality: 0.94,
                costPerToken: 0.0000001,
                throughput: 50
            },
            contextWindow: 2048,
            active: true
        });

        // Local models
        this.registerModel({
            id: 'fast-classification',
            name: 'Fast Classification Model',
            provider: 'local',
            version: '1.0',
            capabilities: {
                tasks: ['classification'],
                classificationTypes: ['binary', 'multi-class']
            },
            performanceMetrics: {
                latency: 10,
                quality: 0.82,
                costPerToken: 0,
                throughput: 200
            },
            contextWindow: 1024,
            active: true
        });
    }
} 