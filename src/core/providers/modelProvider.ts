/**
 * Model Provider Interface for NeuroCore
 * 
 * This module defines a standardized interface for interacting
 * with different AI model providers (OpenAI, Anthropic, etc.).
 */

/**
 * Parameters for text generation
 */
export interface CompletionParams {
    /**
     * The prompt or messages for generation
     */
    prompt?: string;

    /**
     * Messages array for chat models
     */
    messages?: Array<{
        role: string;
        content: string | Array<{
            type: string;
            [key: string]: any;
        }>;
    }>;

    /**
     * Model to use
     */
    model: string;

    /**
     * Maximum tokens to generate
     */
    maxTokens?: number;

    /**
     * Temperature (0-2)
     */
    temperature?: number;

    /**
     * Top-p sampling
     */
    topP?: number;

    /**
     * System message for chat models
     */
    system?: string;

    /**
     * Tools/functions the model can use
     */
    tools?: any[];

    /**
     * Response format
     */
    responseFormat?: {
        type: string;
        [key: string]: any;
    };

    /**
     * Additional provider-specific parameters
     */
    [key: string]: any;
}

/**
 * Response from text generation
 */
export interface CompletionResponse {
    /**
     * Generated text content
     */
    content: string | Array<{
        type: string;
        text?: string;
        [key: string]: any;
    }>;

    /**
     * Model used for generation
     */
    model: string;

    /**
     * Usage statistics
     */
    usage?: {
        promptTokens?: number;
        completionTokens?: number;
        totalTokens?: number;
    };

    /**
     * Tool calls made by the model
     */
    toolCalls?: Array<{
        id: string;
        type: string;
        function: {
            name: string;
            arguments: string;
        };
    }>;

    /**
     * Additional provider-specific response data
     */
    [key: string]: any;
}

/**
 * Chunk of a streaming response
 */
export interface CompletionChunk {
    /**
     * Chunk content
     */
    content: string | Array<{
        type: string;
        text?: string;
        [key: string]: any;
    }>;

    /**
     * Whether this is the last chunk
     */
    isLast: boolean;

    /**
     * Tool calls in this chunk
     */
    toolCalls?: Array<{
        id: string;
        type: string;
        function: {
            name: string;
            arguments: string;
        };
    }>;

    /**
     * Index of this chunk
     */
    index?: number;

    /**
     * Additional provider-specific data
     */
    [key: string]: any;
}

/**
 * Parameters for embedding generation
 */
export interface EmbeddingParams {
    /**
     * Text to embed
     */
    text: string | string[];

    /**
     * Model to use
     */
    model?: string;

    /**
     * Embedding type
     */
    type?: 'query' | 'document';

    /**
     * Additional provider-specific parameters
     */
    [key: string]: any;
}

/**
 * Response from embedding generation
 */
export interface EmbeddingResponse {
    /**
     * Embedding vectors
     */
    embeddings: number[][];

    /**
     * Model used for embedding
     */
    model: string;

    /**
     * Usage statistics
     */
    usage?: {
        promptTokens?: number;
        totalTokens?: number;
    };

    /**
     * Additional provider-specific data
     */
    [key: string]: any;
}

/**
 * Parameters for model fine-tuning
 */
export interface FineTuneParams {
    /**
     * Base model to tune
     */
    model: string;

    /**
     * Training dataset
     */
    trainingData: Array<{
        messages?: Array<{
            role: string;
            content: string;
        }>;
        prompt?: string;
        completion?: string;
    }>;

    /**
     * Validation dataset
     */
    validationData?: Array<{
        messages?: Array<{
            role: string;
            content: string;
        }>;
        prompt?: string;
        completion?: string;
    }>;

    /**
     * Number of epochs
     */
    epochs?: number;

    /**
     * Batch size
     */
    batchSize?: number;

    /**
     * Learning rate
     */
    learningRate?: number;

    /**
     * Additional provider-specific parameters
     */
    [key: string]: any;
}

/**
 * Response from model fine-tuning
 */
export interface FineTuneResponse {
    /**
     * Job ID
     */
    jobId: string;

    /**
     * Status of the job
     */
    status: 'created' | 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';

    /**
     * Fine-tuned model ID (when complete)
     */
    fineTunedModel?: string;

    /**
     * Additional provider-specific data
     */
    [key: string]: any;
}

/**
 * Standardized interface for AI model providers
 */
export interface IModelProvider {
    /**
     * Generate text completion
     * 
     * @param params Completion parameters
     * @returns Generated completion
     */
    generateCompletion(params: CompletionParams): Promise<CompletionResponse>;

    /**
     * Stream text completion
     * 
     * @param params Completion parameters
     * @returns Async generator of completion chunks
     */
    streamCompletion(params: CompletionParams): AsyncGenerator<CompletionChunk, void, unknown>;

    /**
     * Generate embeddings
     * 
     * @param params Embedding parameters
     * @returns Generated embeddings
     */
    generateEmbeddings(params: EmbeddingParams): Promise<EmbeddingResponse>;

    /**
     * Get the dimensions of embeddings from this provider
     * 
     * @param model Optional model name
     * @returns Number of dimensions
     */
    getEmbeddingDimensions(model?: string): number;

    /**
     * Create a fine-tuning job
     * 
     * @param params Fine-tuning parameters
     * @returns Fine-tuning job info
     */
    createFineTuningJob(params: FineTuneParams): Promise<FineTuneResponse>;

    /**
     * Get fine-tuning job status
     * 
     * @param jobId Job ID to check
     * @returns Current job status
     */
    getFineTuningJobStatus(jobId: string): Promise<FineTuneResponse>;

    /**
     * Cancel a fine-tuning job
     * 
     * @param jobId Job ID to cancel
     * @returns Cancelled job status
     */
    cancelFineTuningJob(jobId: string): Promise<FineTuneResponse>;

    /**
     * Get available models
     * 
     * @returns List of available models
     */
    listModels(): Promise<Array<{
        id: string;
        created: number;
        ownedBy: string;
        [key: string]: any;
    }>>;
} 