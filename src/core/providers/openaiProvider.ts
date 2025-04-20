/**
 * OpenAI Provider Implementation for NeuroCore
 * 
 * This module implements the IModelProvider interface for the OpenAI API.
 */

import {
    IModelProvider,
    CompletionParams,
    CompletionResponse,
    CompletionChunk,
    EmbeddingParams,
    EmbeddingResponse,
    FineTuneParams,
    FineTuneResponse
} from './modelProvider';

/**
 * Configuration for the OpenAI provider
 */
export interface OpenAIConfig {
    /**
     * API key for OpenAI
     */
    apiKey: string;

    /**
     * API endpoint (optional, for custom setups)
     */
    endpoint?: string;

    /**
     * Organization ID (optional)
     */
    organization?: string;

    /**
     * Default model to use
     */
    defaultModel?: string;

    /**
     * Max retries on rate limit or server errors
     */
    maxRetries?: number;

    /**
     * Base delay for exponential backoff (ms)
     */
    baseRetryDelay?: number;
}

/**
 * OpenAI provider implementation
 */
export class OpenAIProvider implements IModelProvider {
    private config: OpenAIConfig;
    private apiEndpoint: string;
    private defaultModel: string;
    private maxRetries: number;
    private baseRetryDelay: number;

    /**
     * Create a new OpenAI provider
     */
    constructor(config: OpenAIConfig) {
        this.config = config;
        this.apiEndpoint = config.endpoint || 'https://api.openai.com/v1';
        this.defaultModel = config.defaultModel || 'gpt-4o';
        this.maxRetries = config.maxRetries || 3;
        this.baseRetryDelay = config.baseRetryDelay || 1000;
    }

    /**
     * Generate text completion
     * @param params Completion parameters
     * @returns Generated completion
     */
    async generateCompletion(params: CompletionParams): Promise<CompletionResponse> {
        const model = params.model || this.defaultModel;
        const maxTokens = params.maxTokens || 1024;
        const temperature = params.temperature ?? 0.7;
        const topP = params.topP;

        let messages;
        if (params.messages) {
            messages = params.messages;
        } else if (params.prompt) {
            messages = [
                { role: "user", content: params.prompt }
            ];
        } else {
            throw new Error("Either prompt or messages must be provided");
        }

        // Add system message if provided
        if (params.system) {
            messages.unshift({ role: "system", content: params.system });
        }

        const requestData: any = {
            model,
            messages,
            max_tokens: maxTokens,
            temperature,
        };

        if (topP !== undefined) {
            requestData.top_p = topP;
        }

        if (params.tools) {
            requestData.tools = params.tools;
        }

        if (params.responseFormat) {
            requestData.response_format = params.responseFormat;
        }

        try {
            const response = await this.makeRequest('/chat/completions', {
                method: 'POST',
                body: JSON.stringify(requestData)
            });

            const choice = response.choices[0];
            return {
                id: response.id,
                content: choice.message.content || '',
                model: response.model,
                promptTokens: response.usage.prompt_tokens,
                completionTokens: response.usage.completion_tokens,
                finishReason: choice.finish_reason,
                raw: response
            };
        } catch (error) {
            throw this.formatError('Generate completion failed', error);
        }
    }

    /**
     * Stream text completion
     * @param params Completion parameters
     * @returns Async generator of completion chunks
     */
    async *streamCompletion(params: CompletionParams): AsyncGenerator<CompletionChunk, void, unknown> {
        const model = params.model || this.defaultModel;
        const maxTokens = params.maxTokens || 1024;
        const temperature = params.temperature ?? 0.7;
        const topP = params.topP;

        let messages;
        if (params.messages) {
            messages = params.messages;
        } else if (params.prompt) {
            messages = [
                { role: "user", content: params.prompt }
            ];
        } else {
            throw new Error("Either prompt or messages must be provided");
        }

        // Add system message if provided
        if (params.system) {
            messages.unshift({ role: "system", content: params.system });
        }

        const requestData: any = {
            model,
            messages,
            max_tokens: maxTokens,
            temperature,
            stream: true
        };

        if (topP !== undefined) {
            requestData.top_p = topP;
        }

        if (params.tools) {
            requestData.tools = params.tools;
        }

        if (params.responseFormat) {
            requestData.response_format = params.responseFormat;
        }

        try {
            const response = await fetch(`${this.apiEndpoint}/chat/completions`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(requestData)
            });

            if (!response.ok || !response.body) {
                throw new Error(`API request failed: ${response.statusText}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.trim() === '') continue;
                    if (line.trim() === 'data: [DONE]') return;

                    try {
                        const data = line.startsWith('data: ') ?
                            JSON.parse(line.slice(5)) : JSON.parse(line);

                        if (data.choices && data.choices.length > 0) {
                            const choice = data.choices[0];
                            const delta = choice.delta || {};

                            yield {
                                id: data.id,
                                content: delta.content || '',
                                model: data.model,
                                finishReason: choice.finish_reason,
                                isLast: choice.finish_reason !== null,
                                raw: data
                            };
                        }
                    } catch (err) {
                        console.error('Error parsing stream data:', err);
                    }
                }
            }
        } catch (error) {
            throw this.formatError('Stream completion failed', error);
        }
    }

    /**
     * Generate embeddings
     * @param params Embedding parameters
     * @returns Generated embeddings
     */
    async generateEmbeddings(params: EmbeddingParams): Promise<EmbeddingResponse> {
        const model = params.model || 'text-embedding-3-large';
        const requestData = {
            input: params.input,
            model,
            dimensions: params.dimensions
        };

        try {
            const response = await this.makeRequest('/embeddings', {
                method: 'POST',
                body: JSON.stringify(requestData)
            });

            return {
                embeddings: response.data.map((item: any) => item.embedding),
                model: response.model,
                tokenCount: response.usage.total_tokens,
                raw: response
            };
        } catch (error) {
            throw this.formatError('Generate embeddings failed', error);
        }
    }

    /**
     * Get the dimensions of embeddings from this provider
     * @param model Optional model name
     * @returns Number of dimensions
     */
    getEmbeddingDimensions(model?: string): number {
        const embModel = model || 'text-embedding-3-large';
        // Default dimensions for common models
        const dimensions: Record<string, number> = {
            'text-embedding-3-small': 1536,
            'text-embedding-3-large': 3072,
            'text-embedding-ada-002': 1536
        };

        return dimensions[embModel] || 1536;
    }

    /**
     * Create a fine-tuning job
     * @param params Fine-tuning parameters
     * @returns Fine-tuning job info
     */
    async createFineTuningJob(params: FineTuneParams): Promise<FineTuneResponse> {
        const requestData = {
            training_file: params.trainingFile,
            validation_file: params.validationFile,
            model: params.baseModel || 'gpt-3.5-turbo',
            hyperparameters: {
                n_epochs: params.epochs || 3
            },
            suffix: params.suffix
        };

        try {
            const response = await this.makeRequest('/fine_tuning/jobs', {
                method: 'POST',
                body: JSON.stringify(requestData)
            });

            return {
                id: response.id,
                jobId: response.id,
                model: response.fine_tuned_model,
                status: response.status,
                createdAt: new Date(response.created_at * 1000),
                finishedAt: response.finished_at ? new Date(response.finished_at * 1000) : undefined,
                raw: response
            };
        } catch (error) {
            throw this.formatError('Create fine-tuning job failed', error);
        }
    }

    /**
     * Get fine-tuning job status
     * @param jobId Job ID to check
     * @returns Current job status
     */
    async getFineTuningJobStatus(jobId: string): Promise<FineTuneResponse> {
        try {
            const response = await this.makeRequest(`/fine_tuning/jobs/${jobId}`, {
                method: 'GET'
            });

            return {
                id: response.id,
                jobId: response.id,
                model: response.fine_tuned_model,
                status: response.status,
                createdAt: new Date(response.created_at * 1000),
                finishedAt: response.finished_at ? new Date(response.finished_at * 1000) : undefined,
                raw: response
            };
        } catch (error) {
            throw this.formatError('Get fine-tuning job status failed', error);
        }
    }

    /**
     * Cancel a fine-tuning job
     * @param jobId Job ID to cancel
     * @returns Cancelled job status
     */
    async cancelFineTuningJob(jobId: string): Promise<FineTuneResponse> {
        try {
            const response = await this.makeRequest(`/fine_tuning/jobs/${jobId}/cancel`, {
                method: 'POST'
            });

            return {
                id: response.id,
                jobId: response.id,
                model: response.fine_tuned_model,
                status: response.status,
                createdAt: new Date(response.created_at * 1000),
                finishedAt: response.finished_at ? new Date(response.finished_at * 1000) : undefined,
                raw: response
            };
        } catch (error) {
            throw this.formatError('Cancel fine-tuning job failed', error);
        }
    }

    /**
     * List available models
     * @returns List of available models
     */
    async listModels(): Promise<Array<{ id: string; created: number; ownedBy: string; }>> {
        try {
            const response = await this.makeRequest('/models', {
                method: 'GET'
            });

            return response.data.map((model: any) => ({
                id: model.id,
                created: model.created * 1000, // Convert to milliseconds
                ownedBy: model.owned_by
            }));
        } catch (error) {
            throw this.formatError('List models failed', error);
        }
    }

    /**
     * Make a request to the OpenAI API
     * @param path API path
     * @param options Request options
     * @returns Response data
     */
    private async makeRequest(path: string, options: RequestInit): Promise<any> {
        let retries = 0;

        while (true) {
            try {
                const response = await fetch(`${this.apiEndpoint}${path}`, {
                    ...options,
                    headers: this.getHeaders(options.headers)
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
                    const errorMessage = errorData.error?.message || response.statusText;

                    // Determine if we should retry based on status code
                    if ((response.status === 429 || response.status >= 500) && retries < this.maxRetries) {
                        retries++;
                        const delay = this.baseRetryDelay * Math.pow(2, retries - 1);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }

                    throw new Error(`API error (${response.status}): ${errorMessage}`);
                }

                return await response.json();
            } catch (error) {
                if (retries < this.maxRetries && error instanceof TypeError) {
                    // Network errors can be retried
                    retries++;
                    const delay = this.baseRetryDelay * Math.pow(2, retries - 1);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                throw error;
            }
        }
    }

    /**
     * Get headers for API requests
     * @param additionalHeaders Additional headers to include
     * @returns Headers object
     */
    private getHeaders(additionalHeaders?: HeadersInit): HeadersInit {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`
        };

        if (this.config.organization) {
            headers['OpenAI-Organization'] = this.config.organization;
        }

        if (additionalHeaders) {
            Object.assign(headers, additionalHeaders);
        }

        return headers;
    }

    /**
     * Format error message
     * @param context Error context
     * @param error Error object
     * @returns Formatted error
     */
    private formatError(context: string, error: any): Error {
        const message = error instanceof Error ? error.message : String(error);
        return new Error(`${context}: ${message}`);
    }
} 