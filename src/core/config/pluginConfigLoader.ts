/**
 * Plugin Configuration Loader
 * 
 * Handles loading and validating plugin configuration files including character definitions.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { ValidationError } from '../errors';
import { Character } from '../../types/character';

/**
 * Plugin configuration interface
 */
export interface PluginConfig {
    name: string;
    version: string;
    description: string;
    exposedIntents: IntentDefinition[];
    requiredIntents: RequiredIntent[];
    config: ConfigDefinition;
}

/**
 * Intent definition in plugin config
 */
interface IntentDefinition {
    action: string;
    description: string;
    parameters: Record<string, string>;
    returns: Record<string, string>;
}

/**
 * Required intent definition
 */
interface RequiredIntent {
    action: string;
    description: string;
    required: boolean;
}

/**
 * Configuration definition
 */
interface ConfigDefinition {
    required: string[];
    optional: string[];
    defaults: Record<string, any>;
    environment: Record<string, string>;
}

/**
 * Validation result for configuration files
 */
export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Plugin configuration loader
 */
export class PluginConfigLoader {
    /**
     * Load and validate a plugin configuration file
     * 
     * @param configPath Path to the plugin configuration file
     * @returns Validated plugin configuration
     */
    loadPluginConfig(configPath: string): PluginConfig {
        try {
            // Check if file exists
            if (!existsSync(configPath)) {
                throw new ValidationError(`Plugin configuration file not found: ${configPath}`);
            }

            // Read and parse file
            const configData = JSON.parse(readFileSync(configPath, 'utf8'));

            // Validate configuration
            const validationResult = this.validatePluginConfig(configData);

            if (!validationResult.valid) {
                throw new ValidationError(
                    `Invalid plugin configuration: ${validationResult.errors.join(', ')}`
                );
            }

            // Log any warnings
            if (validationResult.warnings.length > 0) {
                console.warn(`Plugin configuration warnings: ${validationResult.warnings.join(', ')}`);
            }

            return configData;
        } catch (error) {
            if (error instanceof SyntaxError) {
                throw new ValidationError(`Invalid JSON in plugin configuration: ${error.message}`);
            }
            throw error;
        }
    }

    /**
     * Load and validate a character definition file
     * 
     * @param characterPath Path to the character definition file
     * @returns Character definition object
     */
    loadCharacterDefinition(characterPath: string): any {
        try {
            // Check if file exists
            if (!existsSync(characterPath)) {
                throw new ValidationError(`Character definition file not found: ${characterPath}`);
            }

            // Read and parse file
            const characterData = JSON.parse(readFileSync(characterPath, 'utf8'));

            // Validate character definition
            const validationResult = this.validateCharacterDefinition(characterData);

            if (!validationResult.valid) {
                throw new ValidationError(
                    `Invalid character definition: ${validationResult.errors.join(', ')}`
                );
            }

            // Log any warnings
            if (validationResult.warnings.length > 0) {
                console.warn(`Character definition warnings: ${validationResult.warnings.join(', ')}`);
            }

            return characterData;
        } catch (error) {
            if (error instanceof SyntaxError) {
                throw new ValidationError(`Invalid JSON in character definition: ${error.message}`);
            }
            throw error;
        }
    }

    /**
     * Locate relevant configuration files in a plugin directory
     * 
     * @param pluginDir Plugin directory
     * @returns Paths to configuration files
     */
    locateConfigFiles(pluginDir: string): {
        pluginConfig?: string;
        characterDefinitions: string[]
    } {
        const result = {
            pluginConfig: undefined as string | undefined,
            characterDefinitions: [] as string[]
        };

        // Common configuration file names
        const configNames = ['plugin-config.json', 'config.json'];
        const characterDir = join(pluginDir, 'characters');

        // Look for plugin configuration
        for (const name of configNames) {
            const path = join(pluginDir, name);
            if (existsSync(path)) {
                result.pluginConfig = path;
                break;
            }
        }

        // Look for character definitions
        if (existsSync(characterDir)) {
            const characterFiles = this.findFilesWithExtension(characterDir, '.json');
            result.characterDefinitions = characterFiles;
        }

        return result;
    }

    /**
     * Find files with a specific extension in a directory
     * 
     * @param dir Directory to search
     * @param extension File extension to match
     * @returns Array of file paths
     */
    private findFilesWithExtension(dir: string, extension: string): string[] {
        try {
            const { readdirSync, statSync } = require('fs');
            const { join } = require('path');

            // Get all files with the specified extension
            return readdirSync(dir)
                .filter((file: string) => file.endsWith(extension))
                .map((file: string) => join(dir, file));
        } catch (error) {
            console.error(`Error reading directory: ${error}`);
            return [];
        }
    }

    /**
     * Validate plugin configuration
     * 
     * @param config Configuration object to validate
     * @returns Validation result
     */
    private validatePluginConfig(config: any): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Check required top-level fields
        const requiredFields = ['name', 'version', 'description', 'exposedIntents'];
        for (const field of requiredFields) {
            if (!config[field]) {
                errors.push(`Missing required field: ${field}`);
            }
        }

        // Validate exposed intents
        if (Array.isArray(config.exposedIntents)) {
            config.exposedIntents.forEach((intent: string, index: number) => {
                if (!intent) {
                    errors.push(`Exposed intent at index ${index} is missing 'action' field`);
                }
                if (!intent) {
                    warnings.push(`Exposed intent '${intent || index}' is missing 'description'`);
                }
            });
        } else if (config.exposedIntents !== undefined) {
            errors.push("'exposedIntents' must be an array");
        }

        // Validate required intents
        if (Array.isArray(config.requiredIntents)) {
            config.requiredIntents.forEach((intent: any, index: number) => {
                if (!intent.action) {
                    errors.push(`Required intent at index ${index} is missing 'action' field`);
                }
                if (intent.required === undefined) {
                    warnings.push(`Required intent '${intent.action || index}' is missing 'required' field`);
                }
            });
        } else if (config.requiredIntents !== undefined) {
            errors.push("'requiredIntents' must be an array");
        }

        // Validate configuration section
        if (config.config) {
            // Validate required config parameters
            if (!Array.isArray(config.config.required)) {
                errors.push("config.required must be an array");
            }

            // Check defaults for required fields
            if (Array.isArray(config.config.required) && config.config.defaults) {
                config.config.required.forEach((param: string) => {
                    if (config.config.defaults[param] === undefined) {
                        warnings.push(`Required parameter '${param}' has no default value`);
                    }
                });
            }
        } else {
            warnings.push("Missing 'config' section");
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Validate character definition
     * 
     * @param character Character definition to validate
     * @returns Validation result
     */
    private validateCharacterDefinition(character: any): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Check required fields
        if (!character.name) {
            errors.push("Missing required field: 'name'");
        }

        // Check bio field
        if (!character.bio) {
            errors.push("Missing required field: 'bio'");
        } else if (!Array.isArray(character.bio)) {
            errors.push("'bio' must be an array");
        } else if (character.bio.length === 0) {
            warnings.push("'bio' array is empty");
        }

        // Check adjectives
        if (!character.adjectives) {
            warnings.push("Missing 'adjectives' for personality traits");
        } else if (!Array.isArray(character.adjectives)) {
            errors.push("'adjectives' must be an array");
        } else if (character.adjectives.length === 0) {
            warnings.push("'adjectives' array is empty");
        }

        // Check style
        if (!character.style) {
            warnings.push("Missing 'style' for communication styling");
        } else {
            // Check style fields
            const styleContexts = ['all', 'chat', 'post'];
            let hasAnyStyle = false;

            for (const context of styleContexts) {
                if (character.style[context]) {
                    hasAnyStyle = true;
                    if (!Array.isArray(character.style[context])) {
                        errors.push(`'style.${context}' must be an array`);
                    }
                }
            }

            if (!hasAnyStyle) {
                warnings.push("'style' object has no context definitions");
            }
        }

        // Check examples
        if (!character.messageExamples || !Array.isArray(character.messageExamples)) {
            warnings.push("Missing or invalid 'messageExamples'");
        } else if (character.messageExamples.length === 0) {
            warnings.push("'messageExamples' array is empty");
        } else {
            // Validate example format
            character.messageExamples.forEach((example: any, index: number) => {
                if (!Array.isArray(example) || example.length < 2) {
                    warnings.push(`Message example at index ${index} should be an array with at least 2 messages`);
                }
            });
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }
} 