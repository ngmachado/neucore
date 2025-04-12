/**
 * Anthropic Provider Implementation for NeuroCore
 * 
 * This module implements the IModelProvider interface for
 * the Anthropic API (Claude models).
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
 * Configuration for the Anthropic provider
 */
export interface AnthropicConfig {
    /**
     * API key for Anthropic
     */
    apiKey: string;

    /**
     * API endpoint (optional, for custom setups)
     */
    endpoint?: string;

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
 * Anthropic provider implementation
 */
export class AnthropicProvider implements IModelProvider {
    private config: AnthropicConfig;
    private apiEndpoint: string;
    private defaultModel: string;
    private maxRetries: number;
    private baseRetryDelay: number;

    /**
     * Create a new Anthropic provider
     */
    constructor(config: AnthropicConfig) {
        this.config = config;
        this.apiEndpoint = config.endpoint || 'https://api.anthropic.com';
        this.defaultModel = config.defaultModel || 'claude-3-opus-20240229';
        this.maxRetries = config.maxRetries || 3;
        this.baseRetryDelay = config.baseRetryDelay || 1000;
    }

    /**
     * Get headers for API requests
     */
    private getHeaders(requestId?: string): Record<string, string> {
        return {
            'Content-Type': 'application/json',
            'x-api-key': this.config.apiKey,
            'anthropic-version': '2023-06-01',
            ...(requestId ? { 'x-request-id': requestId } : {})
        };
    }

    /**
     * Create a request ID if not provided
     */
    private createRequestId(): string {
        return 'req_' + Math.random().toString(36).substring(2, 15);
    }

    /**
     * Handle API errors with retries
     */
    private async handleApiRequest<T>(
        requestFn: () => Promise<Response>,
        attempt = 0
    ): Promise<T> {
        try {
            const response = await requestFn();

            if (!response.ok) {
                const errorBody = await response.text();

                if (
                    (response.status === 429 || response.status >= 500) &&
                    attempt < this.maxRetries
                ) {
                    // Rate limit or server error, retry with exponential backoff
                    const delay = this.baseRetryDelay * Math.pow(2, attempt);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return this.handleApiRequest<T>(requestFn, attempt + 1);
                }

                throw new Error(`Anthropic API error (${response.status}): ${errorBody}`);
            }

            return await response.json() as T;
        } catch (error) {
            if (
                error instanceof Error &&
                error.message.includes('fetch') &&
                attempt < this.maxRetries
            ) {
                // Network error, retry
                const delay = this.baseRetryDelay * Math.pow(2, attempt);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.handleApiRequest<T>(requestFn, attempt + 1);
            }

            throw error;
        }
    }

    /**
     * Generate text completion
     */
    async generateCompletion(params: CompletionParams): Promise<CompletionResponse> {
        // Determine if we should use messages or old completion API
        if (params.messages) {
            // Use messages API (Claude 3)
            const requestData = {
                messages: params.messages,
                model: params.model || this.defaultModel,
                max_tokens: params.maxTokens || 1000,
                temperature: params.temperature,
                top_p: params.topP,
                system: params.system || '',
                tools: params.tools
            };

            const requestId = this.createRequestId();

            const response = await this.handleApiRequest<any>(() =>
                fetch(`${this.apiEndpoint}/v1/messages`, {
                    method: 'POST',
                    headers: this.getHeaders(requestId),
                    body: JSON.stringify(requestData)
                })
            );

            // Convert Anthropic response to standard format
            return {
                content: response.content,
                model: response.model,
                usage: {
                    promptTokens: response.usage?.input_tokens,
                    completionTokens: response.usage?.output_tokens,
                    totalTokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
                },
                toolCalls: response.tool_use?.tools?.map((tool: any) => ({
                    id: tool.id,
                    type: 'function',
                    function: {
                        name: tool.name,
                        arguments: JSON.stringify(tool.input)
                    }
                })),
                id: response.id,
                stop_reason: response.stop_reason
            };
        } else {
            // Use legacy completion API
            const requestData = {
                prompt: params.prompt,
                model: params.model || this.defaultModel,
                max_tokens_to_sample: params.maxTokens || 1000,
                temperature: params.temperature,
                top_p: params.topP
            };

            const requestId = this.createRequestId();

            const response = await this.handleApiRequest<any>(() =>
                fetch(`${this.apiEndpoint}/v1/complete`, {
                    method: 'POST',
                    headers: this.getHeaders(requestId),
                    body: JSON.stringify(requestData)
                })
            );

            // Convert Anthropic response to standard format
            return {
                content: response.completion,
                model: response.model,
                usage: {
                    // Legacy API doesn't return token counts
                    totalTokens: 0
                },
                stop_reason: response.stop_reason
            };
        }
    }

    /**
     * Stream text completion
     */
    async *streamCompletion(params: CompletionParams): AsyncGenerator<CompletionChunk, void, unknown> {
        // Determine if we should use messages or old completion API
        if (params.messages) {
            // Use messages API (Claude 3)
            const requestData = {
                messages: params.messages,
                model: params.model || this.defaultModel,
                max_tokens: params.maxTokens || 1000,
                temperature: params.temperature,
                top_p: params.topP,
                system: params.system || '',
                tools: params.tools,
                stream: true
            };

            const requestId = this.createRequestId();

            const response = await fetch(`${this.apiEndpoint}/v1/messages`, {
                method: 'POST',
                headers: this.getHeaders(requestId),
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`Anthropic API error (${response.status}): ${errorBody}`);
            }

            if (!response.body) {
                throw new Error('Response body is null');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let index = 0;
            let isDone = false;

            try {
                while (!isDone) {
                    const { done, value } = await reader.read();

                    if (done) {
                        isDone = true;
                        break;
                    }

                    // Decode the received chunk and add to buffer
                    buffer += decoder.decode(value, { stream: true });

                    // Process each line (each event is on a separate line)
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || ''; // Keep the last incomplete line in the buffer

                    for (const line of lines) {
                        if (!line.trim() || !line.startsWith('data: ')) continue;

                        // Extract the JSON part
                        const jsonStr = line.slice(6); // Remove 'data: ' prefix

                        if (jsonStr === '[DONE]') {
                            // End of stream
                            isDone = true;
                            break;
                        }

                        try {
                            const eventData = JSON.parse(jsonStr);

                            if (eventData.type === 'content_block_delta') {
                                const isLast = eventData.delta.stop_reason !== null;

                                yield {
                                    content: [{
                                        type: 'text',
                                        text: eventData.delta.text || ''
                                    }],
                                    isLast,
                                    index: index++
                                };

                                if (isLast) isDone = true;
                            } else if (eventData.type === 'message_stop') {
                                yield {
                                    content: [],
                                    isLast: true,
                                    index: index++
                                };

                                isDone = true;
                            }
                        } catch (e) {
                            console.error('Error parsing SSE data:', e);
                        }
                    }
                }
            } finally {
                reader.releaseLock();
            }
        } else {
            // Legacy API doesn't support streaming directly
            // Simulate streaming with the non-streaming API
            const response = await this.generateCompletion(params);

            // Content can be string or object array
            const content = typeof response.content === 'string'
                ? response.content
                : response.content.map(item => item.text || '').join('');

            // Divide the content into chunks of reasonable size
            const chunkSize = 10; // Number of tokens per chunk (rough approximation)
            const chunks = [];

            for (let i = 0; i < content.length; i += chunkSize) {
                chunks.push(content.substring(i, i + chunkSize));
            }

            let index = 0;

            for (let i = 0; i < chunks.length; i++) {
                yield {
                    content: chunks[i],
                    isLast: i === chunks.length - 1,
                    index: index++
                };

                // Add a small delay between chunks to simulate streaming
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }
    }

    /**
     * Generate embeddings
     */
    async generateEmbeddings(params: EmbeddingParams): Promise<EmbeddingResponse> {
        const texts = Array.isArray(params.text) ? params.text : [params.text];

        if (texts.length === 0) {
            return {
                embeddings: [],
                model: params.model || 'claude-3-sonnet-20240229-embedding'
            };
        }

        const requestData = {
            model: params.model || 'claude-3-sonnet-20240229-embedding',
            input: texts,
            encoding_format: 'float'
        };

        const requestId = this.createRequestId();

        const response = await this.handleApiRequest<any>(() =>
            fetch(`${this.apiEndpoint}/v1/embeddings`, {
                method: 'POST',
                headers: this.getHeaders(requestId),
                body: JSON.stringify(requestData)
            })
        );

        return {
            embeddings: response.data.map((item: any) => item.embedding),
            model: response.model,
            usage: {
                promptTokens: response.usage?.input_tokens,
                totalTokens: response.usage?.input_tokens
            }
        };
    }

    /**
     * Get embedding dimensions
     */
    getEmbeddingDimensions(model?: string): number {
        // Claude embedding dimensions are fixed
        return 1536;
    }

    /**
     * Create a fine-tuning job
     * Not yet supported by Anthropic
     */
    async createFineTuningJob(params: FineTuneParams): Promise<FineTuneResponse> {
        throw new Error('Fine-tuning is not yet supported by Anthropic Claude');
    }

    /**
     * Get fine-tuning job status
     * Not yet supported by Anthropic
     */
    async getFineTuningJobStatus(jobId: string): Promise<FineTuneResponse> {
        throw new Error('Fine-tuning is not yet supported by Anthropic Claude');
    }

    /**
     * Cancel a fine-tuning job
     * Not yet supported by Anthropic
     */
    async cancelFineTuningJob(jobId: string): Promise<FineTuneResponse> {
        throw new Error('Fine-tuning is not yet supported by Anthropic Claude');
    }

    /**
     * List available models
     */
    async listModels(): Promise<Array<{ id: string; created: number; ownedBy: string; }>> {
        return [
            {
                id: 'claude-3-opus-20240229',
                created: 1708617600000, // Feb 22, 2024
                ownedBy: 'anthropic'
            },
            {
                id: 'claude-3-sonnet-20240229',
                created: 1708617600000, // Feb 22, 2024
                ownedBy: 'anthropic'
            },
            {
                id: 'claude-3-haiku-20240307',
                created: 1709769600000, // Mar 7, 2024
                ownedBy: 'anthropic'
            }
        ];
    }
} 