/**
 * Configuration manager implementation
 */

import { ConfigSource, FrameworkConfig } from './interfaces';
import { getLogger } from '../logging';

const logger = getLogger('config-manager');

/**
 * Configuration manager
 * Manages multiple configuration sources with priority
 */
export class ConfigManager {
    private sources: ConfigSource[] = [];
    private cache: Record<string, any> = {};
    private initialized = false;

    /**
     * Create a new configuration manager
     * @param sources Configuration sources in priority order (highest first)
     */
    constructor(sources: ConfigSource[] = []) {
        this.sources = sources;
    }

    /**
     * Add a configuration source
     * @param source Configuration source
     * @param priority Priority (0 = highest)
     */
    addSource(source: ConfigSource, priority = this.sources.length): void {
        this.sources.splice(priority, 0, source);
        this.invalidateCache();
    }

    /**
     * Initialize the configuration manager
     * Loads all configuration sources
     */
    async initialize(): Promise<void> {
        if (this.initialized) {
            logger.warn('Configuration manager already initialized');
            return;
        }

        logger.info('Initializing configuration manager');

        try {
            // Load all configuration sources
            for (const source of this.sources) {
                await source.load();
            }

            // Build initial cache
            this.rebuildCache();

            this.initialized = true;
            logger.info('Configuration manager initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize configuration manager:', error);
            throw error;
        }
    }

    /**
     * Get a configuration value
     * @param key Configuration key
     * @param defaultValue Default value if not found
     * @returns Configuration value or default
     */
    get<T>(key: string, defaultValue?: T): T {
        this.checkInitialized();

        // Check cache first
        if (key in this.cache) {
            return this.cache[key] as T;
        }

        // Check sources in priority order
        for (const source of this.sources) {
            if (source.has(key)) {
                const value = source.get<T>(key);
                this.cache[key] = value;
                return value;
            }
        }

        // Return default value
        return defaultValue as T;
    }

    /**
     * Set a configuration value in the highest priority source
     * @param key Configuration key
     * @param value Configuration value
     */
    set<T>(key: string, value: T): void {
        this.checkInitialized();

        if (this.sources.length === 0) {
            throw new Error('No configuration sources available');
        }

        // Set in highest priority source
        this.sources[0].set(key, value);
        this.cache[key] = value;
    }

    /**
     * Check if a configuration key exists
     * @param key Configuration key
     * @returns Whether the key exists
     */
    has(key: string): boolean {
        this.checkInitialized();

        // Check cache first
        if (key in this.cache) {
            return true;
        }

        // Check sources in priority order
        for (const source of this.sources) {
            if (source.has(key)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get all configuration values
     * @returns All configuration values
     */
    getAll(): Record<string, any> {
        this.checkInitialized();

        // Return a copy of the cache
        return { ...this.cache };
    }

    /**
     * Get framework configuration
     * @returns Framework configuration
     */
    getFrameworkConfig(): FrameworkConfig {
        return this.get<FrameworkConfig>('framework', {});
    }

    /**
     * Invalidate the configuration cache
     */
    invalidateCache(): void {
        this.cache = {};
    }

    /**
     * Rebuild the configuration cache
     */
    private rebuildCache(): void {
        this.cache = {};

        // Build cache from all sources in reverse order (lowest to highest priority)
        for (let i = this.sources.length - 1; i >= 0; i--) {
            const source = this.sources[i];
            const config = source.getAll();

            // Merge into cache
            Object.assign(this.cache, config);
        }
    }

    /**
     * Check if the configuration manager is initialized
     * @throws Error if not initialized
     */
    private checkInitialized(): void {
        if (!this.initialized) {
            throw new Error('Configuration manager not initialized. Call initialize() first.');
        }
    }
} 