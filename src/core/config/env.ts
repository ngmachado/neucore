/**
 * Environment variable configuration source
 */

import { ConfigSource, EnvConfigOptions } from './interfaces';
import { getLogger } from '../logging';

const logger = getLogger('env-config');

/**
 * Convert snake_case to camelCase
 * @param str String to convert
 * @returns Converted string
 */
function snakeToCamel(str: string): string {
    return str.toLowerCase().replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Parse a string value to the appropriate type
 * @param value String value
 * @returns Parsed value
 */
function parseValue(value: string): any {
    // Check if boolean
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;

    // Check if number
    if (/^-?\d+(\.\d+)?$/.test(value)) {
        const num = parseFloat(value);
        if (!isNaN(num)) return num;
    }

    // Check if JSON
    if ((value.startsWith('{') && value.endsWith('}')) ||
        (value.startsWith('[') && value.endsWith(']'))) {
        try {
            return JSON.parse(value);
        } catch (e) {
            // Not valid JSON, return as string
        }
    }

    // Default to string
    return value;
}

/**
 * Environment variable configuration source
 * Loads configuration from environment variables with a specified prefix
 */
export class EnvConfigSource implements ConfigSource {
    private config: Record<string, any> = {};
    private options: Required<EnvConfigOptions>;

    /**
     * Create a new environment variable configuration source
     * @param options Configuration options
     */
    constructor(options: EnvConfigOptions = {}) {
        this.options = {
            prefix: options.prefix || 'NEUROCORE_',
            transformKeys: options.transformKeys !== false,
            parseValues: options.parseValues !== false
        };
    }

    /**
     * Get a configuration value
     * @param key Configuration key
     * @param defaultValue Default value if not found
     * @returns Configuration value or default
     */
    get<T>(key: string, defaultValue?: T): T {
        return key in this.config ? this.config[key] : defaultValue as T;
    }

    /**
     * Set a configuration value
     * @param key Configuration key
     * @param value Configuration value
     */
    set<T>(key: string, value: T): void {
        this.config[key] = value;
    }

    /**
     * Check if a configuration key exists
     * @param key Configuration key
     * @returns Whether the key exists
     */
    has(key: string): boolean {
        return key in this.config;
    }

    /**
     * Get all configuration values
     * @returns All configuration values
     */
    getAll(): Record<string, any> {
        return { ...this.config };
    }

    /**
     * Load configuration from environment variables
     * @returns Whether the load was successful
     */
    async load(): Promise<boolean> {
        try {
            logger.debug(`Loading environment variables with prefix '${this.options.prefix}'`);

            // Get all environment variables with the specified prefix
            const env = process.env;
            const prefix = this.options.prefix.toUpperCase();

            for (const [key, value] of Object.entries(env)) {
                if (key.startsWith(prefix) && value !== undefined) {
                    // Remove prefix and convert to desired case
                    let configKey = key.substring(prefix.length);

                    if (this.options.transformKeys) {
                        configKey = snakeToCamel(configKey);
                    }

                    // Parse value if enabled
                    const configValue = this.options.parseValues ? parseValue(value) : value;

                    // Store in config
                    this.config[configKey] = configValue;
                }
            }

            logger.debug(`Loaded ${Object.keys(this.config).length} environment variables`);
            return true;
        } catch (error) {
            logger.error('Failed to load environment variables:', error);
            return false;
        }
    }
} 