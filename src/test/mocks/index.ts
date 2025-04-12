/**
 * Mock implementations for testing and development
 * 
 * These mocks should be used for testing and development only.
 * Do not use in production code.
 */

import { IModelProvider, CompletionParams, CompletionResponse, EmbeddingParams, EmbeddingResponse, FineTuneParams, FineTuneResponse } from '../../core/providers/modelProvider';
import { IMemoryManager, Memory, GetMemoriesOptions, SearchMemoriesOptions } from '../../core/memory/types';
import { UUID } from '../../types';

/**
 * Mock model provider for testing
 */
export class MockModelProvider implements IModelProvider {
    public async generateCompletion(params: CompletionParams): Promise<CompletionResponse> {
        const response = 'This is a mock response';
        return {
            content: response,
            model: params.model,
            usage: {
                promptTokens: params.prompt ? params.prompt.length / 4 : 0,
                completionTokens: response.length / 4,
                totalTokens: (params.prompt ? params.prompt.length : 0 + response.length) / 4
            }
        };
    }

    public async *streamCompletion(params: CompletionParams): AsyncGenerator<any, void, unknown> {
        yield {
            content: 'This is a mock streaming response',
            isLast: true
        };
    }

    public async generateEmbeddings(params: EmbeddingParams): Promise<EmbeddingResponse> {
        const texts = Array.isArray(params.text) ? params.text : [params.text];
        const embeddings = texts.map(() => Array(1536).fill(0));
        return {
            embeddings,
            model: params.model || 'text-embedding-ada-002',
            usage: {
                promptTokens: texts.join('').length / 4,
                totalTokens: texts.join('').length / 4
            }
        };
    }

    public getEmbeddingDimensions(model?: string): number {
        return 1536;
    }

    public async createFineTuningJob(params: FineTuneParams): Promise<FineTuneResponse> {
        return {
            jobId: 'mock-job-id',
            status: 'created'
        };
    }

    public async getFineTuningJobStatus(jobId: string): Promise<FineTuneResponse> {
        return {
            jobId,
            status: 'succeeded',
            fineTunedModel: 'mock-fine-tuned-model'
        };
    }

    public async cancelFineTuningJob(jobId: string): Promise<FineTuneResponse> {
        return {
            jobId,
            status: 'cancelled'
        };
    }

    public async listModels(): Promise<Array<{ id: string; created: number; ownedBy: string;[key: string]: any; }>> {
        return [
            {
                id: 'mock-model',
                created: Date.now(),
                ownedBy: 'mock-owner'
            }
        ];
    }
}

/**
 * Mock memory manager for testing
 */
export class MockMemoryManager implements IMemoryManager {
    tableName = "memories";
    private memories: Memory[] = [];

    constructor(initialMemories?: Memory[]) {
        if (initialMemories) {
            this.memories = [...initialMemories];
        }
    }

    async addEmbeddingToMemory(memory: Memory): Promise<Memory> {
        const updatedMemory = {
            ...memory,
            embedding: Array.from({ length: 384 }, () => Math.random() * 2 - 1)
        };
        return updatedMemory;
    }

    async getMemories(options: GetMemoriesOptions): Promise<Memory[]> {
        return this.memories
            .filter(m => m.roomId === options.roomId)
            .slice(0, options.count || 10);
    }

    async searchMemoriesByEmbedding(embedding: number[], options: SearchMemoriesOptions): Promise<Memory[]> {
        return this.memories
            .filter(m => m.roomId === options.roomId)
            .slice(0, options.count || 5);
    }

    async createMemory(memory: Memory, unique?: boolean): Promise<void> {
        if (!memory.id) {
            memory.id = this.generateUUID();
        }
        memory.createdAt = memory.createdAt || new Date();
        memory.updatedAt = memory.updatedAt || new Date();

        this.memories.push({ ...memory });
    }

    async getMemoryById(id: UUID): Promise<Memory | null> {
        const memory = this.memories.find(m => m.id === id);
        return memory ? { ...memory } : null;
    }

    async removeMemory(id: UUID): Promise<void> {
        this.memories = this.memories.filter(m => m.id !== id);
    }

    async removeAllMemories(roomId: UUID): Promise<void> {
        this.memories = this.memories.filter(m => m.roomId !== roomId);
    }

    async countMemories(roomId: UUID, unique?: boolean): Promise<number> {
        return this.memories.filter(m => m.roomId === roomId).length;
    }

    async getMemoriesByRoomIds(params: { roomIds: UUID[], limit?: number }): Promise<Memory[]> {
        return this.memories
            .filter(m => params.roomIds.includes(m.roomId))
            .slice(0, params.limit || 10);
    }

    async getCachedEmbeddings(content: string): Promise<Array<{ embedding: number[], levenshtein_score: number }>> {
        return [{
            embedding: Array.from({ length: 384 }, () => Math.random() * 2 - 1),
            levenshtein_score: 0.9
        }];
    }

    private generateUUID(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}

/**
 * More mock implementations will be added as needed
 */ 