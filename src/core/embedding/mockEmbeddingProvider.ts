import { UUID } from '../../types';

/**
 * Mock embedding provider for testing
 */
export class MockEmbeddingProvider {
    private dimensions: number = 384;

    constructor(options: { dimensions?: number } = {}) {
        if (options.dimensions) {
            this.dimensions = options.dimensions;
        }
    }

    /**
     * Get the dimensions of the embeddings
     */
    getDimensions(): number {
        return this.dimensions;
    }

    /**
     * Generate an embedding vector for text
     * @param text The text to embed
     * @returns Embedding vector
     */
    async generateEmbedding(text: string): Promise<number[]> {
        // Create a deterministic but simple embedding based on text hash
        const hash = this.simpleHash(text);

        // Generate vector where each element is derived from hash but different
        const embedding = new Array(this.dimensions).fill(0);
        for (let i = 0; i < this.dimensions; i++) {
            // Generate a value between -1 and 1 based on hash and position
            const val = (((hash + i) % 1000) / 500) - 1;
            embedding[i] = val;
        }

        // Normalize the vector to unit length
        const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        return embedding.map(val => val / magnitude);
    }

    /**
     * Simple hash function to generate a number from a string
     */
    private simpleHash(text: string): number {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }
} 