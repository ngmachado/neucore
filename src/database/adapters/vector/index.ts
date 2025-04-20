import { VectorSearchOptions } from '../../../core/database/interfaces';
import { MemoryEntity } from '../../../core/database/interfaces';
import { getLogger } from '../../../core/logging';

const logger = getLogger('VectorAdapter');

/**
 * VectorAdapter for handling embeddings and vector search
 * Uses OpenAI's text-embedding-3-large model for generating embeddings
 */
export class VectorAdapter {
    private initialized: boolean = false;
    private apiKey: string | null = null;
    private apiEndpoint: string = 'https://api.openai.com/v1';
    private embeddingModel: string = 'text-embedding-3-large';
    private embeddingDimensions: number = 3072; // text-embedding-3-large has 3072 dimensions

    constructor() {
        // Try to get API key from environment variable
        this.apiKey = process.env.OPENAI_API_KEY || null;
    }

    /**
     * Initialize the embedding system
     */
    async initialize(): Promise<void> {
        if (this.initialized) {
            logger.warn('Vector adapter already initialized');
            return;
        }

        try {
            if (!this.apiKey) {
                throw new Error('OpenAI API key not found. Set OPENAI_API_KEY environment variable.');
            }

            // Verify API access
            await this.testApiConnection();
            logger.info(`Vector adapter initialized successfully with OpenAI ${this.embeddingModel}`);
            this.initialized = true;
        } catch (error) {
            logger.error('Failed to initialize vector adapter:', error);
            throw error;
        }
    }

    /**
     * Test connection to OpenAI API
     */
    private async testApiConnection(): Promise<void> {
        try {
            // Simple test to verify API access - get embedding for a single word
            await this.generateOpenAIEmbedding("test");
            logger.info('Successfully connected to OpenAI API');
        } catch (error) {
            logger.error('Failed to connect to OpenAI API:', error);
            throw error;
        }
    }

    /**
     * Generate an embedding for text
     * @param text Text to embed
     * @returns Embedding vector
     */
    async generateEmbedding(text: string): Promise<number[]> {
        this.checkInitialized();

        // Truncate very long texts to 8000 tokens (~32k chars)
        const truncatedText = text.length > 32000 ? text.substring(0, 32000) : text;

        try {
            return await this.generateOpenAIEmbedding(truncatedText);
        } catch (error) {
            logger.error('Error generating embedding:', error);
            throw error;
        }
    }

    /**
     * Generate embedding using OpenAI API
     * @param text Text to embed
     * @returns Embedding vector
     */
    private async generateOpenAIEmbedding(text: string): Promise<number[]> {
        logger.info(`Generating embedding for text (${text.length} chars) using OpenAI ${this.embeddingModel}`);

        const requestData = {
            input: text,
            model: this.embeddingModel,
            encoding_format: "float"
        };

        logger.info('Sending request to OpenAI embeddings API...');
        const response = await fetch(`${this.apiEndpoint}/embeddings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            logger.error(`OpenAI API error (${response.status}): ${errorText}`);
            throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        logger.info(`Successfully received embedding with ${data.data[0].embedding.length} dimensions from OpenAI`);
        return data.data[0].embedding;
    }

    /**
     * Get the dimensions of the current embedding model
     */
    getDimensions(): number {
        return this.embeddingDimensions;
    }

    /**
     * Search database by embedding similarity
     * This implementation delegates to the SQLite adapter
     */
    async searchByEmbedding(query: string, options: Partial<VectorSearchOptions> = {}): Promise<Array<MemoryEntity & { similarity: number }>> {
        this.checkInitialized();

        // Simply return empty results - the SQLite adapter will handle real search
        return [];
    }

    /**
     * Verify the adapter is initialized
     */
    private checkInitialized(): void {
        if (!this.initialized) {
            throw new Error('Vector adapter not initialized. Call initialize() first.');
        }
    }
} 