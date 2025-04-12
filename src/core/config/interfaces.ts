/**
 * Configuration system interfaces
 */

import { LogLevel } from '../../types';

/**
 * Configuration source interface
 */
export interface ConfigSource {
    /**
     * Get a configuration value
     * @param key Configuration key
     * @param defaultValue Default value if not found
     * @returns Configuration value or default
     */
    get<T>(key: string, defaultValue?: T): T;

    /**
     * Set a configuration value
     * @param key Configuration key
     * @param value Configuration value
     */
    set<T>(key: string, value: T): void;

    /**
     * Check if a configuration key exists
     * @param key Configuration key
     * @returns Whether the key exists
     */
    has(key: string): boolean;

    /**
     * Get all configuration values
     * @returns All configuration values
     */
    getAll(): Record<string, any>;

    /**
     * Load configuration from a source
     * @returns Whether the load was successful
     */
    load(): Promise<boolean>;
}

/**
 * Environment variable configuration source
 * Loads configuration from environment variables with a specified prefix
 */
export interface EnvConfigOptions {
    /**
     * Prefix for environment variables
     * @default 'NEUROCORE_'
     */
    prefix?: string;

    /**
     * Whether to transform keys from SNAKE_CASE to camelCase
     * @default true
     */
    transformKeys?: boolean;

    /**
     * Parse numeric and boolean values
     * @default true
     */
    parseValues?: boolean;
}

/**
 * File configuration source options
 */
export interface FileConfigOptions {
    /**
     * Path to the configuration file
     */
    path: string;

    /**
     * Whether to watch for file changes
     * @default false
     */
    watch?: boolean;

    /**
     * Whether to create the file if it doesn't exist
     * @default false
     */
    createIfMissing?: boolean;
}

/**
 * Framework configuration
 */
export interface FrameworkConfig {
    /**
     * Logging configuration
     */
    logging?: {
        /**
         * Log level
         * @default LogLevel.INFO
         */
        level?: LogLevel;

        /**
         * Output format
         * @default 'text'
         */
        format?: 'text' | 'json';

        /**
         * Log output destination
         * @default 'console'
         */
        destination?: 'console' | 'file';

        /**
         * Path to log file if destination is 'file'
         */
        filePath?: string;
    };

    /**
     * Database configuration
     */
    database?: {
        /**
         * Database adapter to use
         * @default 'sqlite'
         */
        adapter?: string;

        /**
         * Database connection options
         */
        options?: Record<string, any>;
    };

    /**
     * MCP configuration
     */
    mcp?: {
        /**
         * Provider configuration
         */
        providers?: Record<string, {
            /**
             * Whether the provider is enabled
             */
            enabled: boolean;

            /**
             * Provider API key if required
             */
            apiKey?: string;

            /**
             * Provider options
             */
            options?: Record<string, any>;
        }>;
    };

    /**
     * Runtime configuration
     */
    runtime?: {
        /**
         * Embedding configuration
         */
        embedding?: {
            /**
             * Embedding provider to use
             * @default 'openai'
             */
            provider?: string;

            /**
             * Embedding model to use
             */
            model?: string;

            /**
             * Embedding dimensions
             * @default 1536
             */
            dimensions?: number;
        };
    };
} 