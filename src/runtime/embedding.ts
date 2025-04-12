/**
 * Runtime Embedding for NeuroCore
 */

import { UUID } from '../types';
import { IModelProvider, EmbeddingParams } from '../core/providers/modelProvider';

/**
 * Runtime embedding configuration
 */
export interface RuntimeEmbeddingConfig {
    model?: string;
    dimensions?: number;
    maxTokens?: number;
}

/**
 * Runtime embedding class
 */
export class RuntimeEmbedding {
    private modelProvider: IModelProvider;
    private config: RuntimeEmbeddingConfig;

    constructor(modelProvider: IModelProvider, config: RuntimeEmbeddingConfig = {}) {
        this.modelProvider = modelProvider;
        this.config = {
            model: 'text-embedding-ada-002',
            dimensions: 1536,
            maxTokens: 8191,
            ...config
        };
    }

    /**
     * Get embedding for text
     */
    public async getEmbedding(text: string): Promise<number[]> {
        const response = await this.modelProvider.generateEmbeddings({
            model: this.config.model!,
            text
        });
        return response.embeddings[0];
    }

    /**
     * Get embeddings for multiple texts
     */
    public async getEmbeddings(texts: string[]): Promise<number[][]> {
        const response = await this.modelProvider.generateEmbeddings({
            model: this.config.model!,
            text: texts
        });
        return response.embeddings;
    }

    /**
     * Get embedding dimensions
     */
    public async getDimensions(): Promise<number> {
        return this.modelProvider.getEmbeddingDimensions(this.config.model);
    }
} 