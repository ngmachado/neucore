export type TaskType = 'classification' | 'generation' | 'embedding';
export type ClassificationType = 'binary' | 'multi-class';
export type GenerationType = 'short' | 'long' | 'creative' | 'factual';
export type EmbeddingType = 'semantic' | 'contextual';
export type ModelProvider = 'openai' | 'anthropic' | 'cohere' | 'local' | string;

/**
 * Model selection criteria
 */
export interface ModelSelectionCriteria {
    taskType: TaskType;
    performanceRequirements?: {
        maxLatency?: number;
        minQuality?: number;
        maxCost?: number;
    };
    dataCharacteristics?: {
        textLength?: number;
        format?: string;
        complexity?: 'low' | 'medium' | 'high';
    };
    specificRequirements?: {
        classificationType?: ClassificationType;
        generationType?: GenerationType;
        embeddingType?: EmbeddingType;
        dimensionality?: number;
    };
}

/**
 * Model selection result
 */
export interface ModelSelectionResult {
    selectedModel: string;
    confidence: number;
    reasoning: string[];
    alternatives: string[];
    metadata: {
        provider: string;
        capabilities: string[];
        performanceMetrics: Record<string, number>;
    };
}

/**
 * Decision node interface for the model selection tree
 */
export interface DecisionNode {
    id: string;
    type: 'decision' | 'result';
    criteria?: (criteria: ModelSelectionCriteria) => boolean;
    children?: DecisionNode[];
    result?: ModelSelectionResult;
}

/**
 * Actual AI model definition with its capabilities and metrics
 */
export interface AIModel {
    id: string;
    name: string;
    provider: ModelProvider;
    version: string;
    capabilities: {
        tasks: TaskType[];
        classificationTypes?: ClassificationType[];
        generationTypes?: GenerationType[];
        embeddingTypes?: EmbeddingType[];
        dimensionality?: number;
    };
    performanceMetrics: {
        latency: number;      // milliseconds
        quality: number;      // 0-1 score
        costPerToken: number; // cost in USD per 1000 tokens
        throughput?: number;  // tokens per second
    };
    contextWindow: number;   // maximum context length in tokens
    active: boolean;         // whether the model is currently available
}

/**
 * Model registry interface to manage AI models
 */
export interface IModelRegistry {
    /**
     * Register a new model in the registry
     */
    registerModel(model: AIModel): void;

    /**
     * Get a model by its ID
     */
    getModelById(id: string): AIModel | undefined;

    /**
     * Find models that match given criteria
     */
    findModels(criteria: ModelSelectionCriteria): AIModel[];

    /**
     * Get all available models
     */
    getAllModels(): AIModel[];

    /**
     * Get models for a specific provider
     */
    getModelsByProvider(provider: ModelProvider): AIModel[];
} 