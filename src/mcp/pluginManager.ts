/**
 * Plugin Manager
 * 
 * Manages plugins and their configurations
 */

import { IPlugin } from './interfaces/plugin';
import { Intent } from './intent';
import { PluginResult, RequestContext } from './interfaces/plugin';
import { PluginConfigLoader, PluginConfig } from '../core/config/pluginConfigLoader';
import { CharacterManager } from '../core/character/characterManager';
import { join } from 'path';
import { ValidationError } from '../core/errors';

/**
 * Plugin Manager options
 */
export interface PluginManagerOptions {
    /**
     * Character manager instance
     */
    characterManager?: CharacterManager;

    /**
     * Plugin configuration loader
     */
    configLoader?: PluginConfigLoader;

    /**
     * Default plugin directory
     */
    pluginDirectory?: string;

    /**
     * Logger instance
     */
    logger?: any;
}

/**
 * Plugin registration information
 */
interface PluginRegistration {
    /**
     * Plugin instance
     */
    plugin: IPlugin;

    /**
     * Plugin configuration
     */
    config?: PluginConfig;

    /**
     * Loaded character IDs
     */
    characterIds: string[];
}

/**
 * Plugin Manager
 */
export class PluginManager {
    /**
     * Registered plugins
     */
    private plugins: Map<string, PluginRegistration> = new Map();

    /**
     * Character manager
     */
    private characterManager?: CharacterManager;

    /**
     * Plugin configuration loader
     */
    private configLoader: PluginConfigLoader;

    /**
     * Default plugin directory
     */
    private pluginDirectory?: string;

    /**
     * Logger
     */
    private logger: any;

    /**
     * Constructor
     */
    constructor(options: PluginManagerOptions = {}) {
        this.characterManager = options.characterManager;
        this.configLoader = options.configLoader || new PluginConfigLoader();
        this.pluginDirectory = options.pluginDirectory;
        this.logger = options.logger || console;
    }

    /**
     * Register a plugin
     * 
     * @param plugin Plugin to register
     * @returns Promise resolved when plugin is registered
     */
    async registerPlugin(plugin: IPlugin): Promise<void> {
        const supportedIntents = plugin.supportedIntents();
        if (!supportedIntents || supportedIntents.length === 0) {
            throw new Error('Plugin does not support any intents');
        }

        // Load plugin configuration if available
        let config: PluginConfig | undefined = undefined;
        let characterIds: string[] = [];

        try {
            // Get plugin configuration
            if (plugin.getConfigPath) {
                const configPath = plugin.getConfigPath();
                if (configPath) {
                    config = this.configLoader.loadPluginConfig(configPath);
                    this.logger.info(`Loaded plugin configuration: ${configPath}`);
                }
            } else if (plugin.getPluginDirectory) {
                // Auto-detect configuration files
                const pluginDir = plugin.getPluginDirectory();
                if (pluginDir) {
                    const files = this.configLoader.locateConfigFiles(pluginDir);
                    if (files.pluginConfig) {
                        config = this.configLoader.loadPluginConfig(files.pluginConfig);
                        this.logger.info(`Auto-loaded plugin configuration: ${files.pluginConfig}`);
                    }
                }
            }

            // Load character definitions if character manager is available
            if (this.characterManager) {
                // Try explicit character paths first
                if (plugin.getCharacterPaths) {
                    const paths = plugin.getCharacterPaths();
                    for (const path of paths) {
                        try {
                            const characterData = this.configLoader.loadCharacterDefinition(path);
                            const character = await this.characterManager.createCharacter(characterData);
                            characterIds.push(character.id);
                            this.logger.info(`Loaded character: ${character.name} (${character.id})`);
                        } catch (error) {
                            this.logger.error(`Failed to load character: ${path}`, error);
                        }
                    }
                }
                // If no explicit paths or none were loaded, try auto-detecting
                if (characterIds.length === 0 && plugin.getPluginDirectory) {
                    const pluginDir = plugin.getPluginDirectory();
                    if (pluginDir) {
                        const files = this.configLoader.locateConfigFiles(pluginDir);
                        for (const path of files.characterDefinitions) {
                            try {
                                const characterData = this.configLoader.loadCharacterDefinition(path);
                                const character = await this.characterManager.createCharacter(characterData);
                                characterIds.push(character.id);
                                this.logger.info(`Auto-loaded character: ${character.name} (${character.id})`);
                            } catch (error) {
                                this.logger.error(`Failed to auto-load character: ${path}`, error);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            this.logger.error('Error loading plugin configuration:', error);
            // Continue registration even if config loading fails
        }

        // Register the plugin
        // Use the first intent as the plugin ID for now
        const pluginId = supportedIntents[0].split(':')[0];

        // Check for duplicates
        if (this.plugins.has(pluginId)) {
            throw new Error(`Plugin with ID ${pluginId} is already registered`);
        }

        // Store registration info
        this.plugins.set(pluginId, {
            plugin,
            config,
            characterIds
        });

        // Initialize the plugin
        if (plugin.initialize) {
            await plugin.initialize();
        }

        this.logger.info(`Registered plugin: ${pluginId} with ${supportedIntents.length} intents`);
    }

    /**
     * Unregister a plugin
     * 
     * @param pluginId Plugin ID to unregister
     * @returns Promise resolved when plugin is unregistered
     */
    async unregisterPlugin(pluginId: string): Promise<void> {
        const registration = this.plugins.get(pluginId);
        if (!registration) {
            throw new Error(`Plugin with ID ${pluginId} is not registered`);
        }

        // Shutdown the plugin
        if (registration.plugin.shutdown) {
            await registration.plugin.shutdown();
        }

        // Remove the plugin
        this.plugins.delete(pluginId);

        this.logger.info(`Unregistered plugin: ${pluginId}`);
    }

    /**
     * Get all registered plugins
     * 
     * @returns Map of plugin IDs to plugin instances
     */
    getPlugins(): Map<string, IPlugin> {
        const result = new Map<string, IPlugin>();
        for (const [id, registration] of this.plugins.entries()) {
            result.set(id, registration.plugin);
        }
        return result;
    }

    /**
     * Get a plugin by ID
     * 
     * @param pluginId Plugin ID
     * @returns Plugin instance or undefined if not found
     */
    getPlugin(pluginId: string): IPlugin | undefined {
        const registration = this.plugins.get(pluginId);
        return registration?.plugin;
    }

    /**
     * Get a plugin's configuration
     * 
     * @param pluginId Plugin ID
     * @returns Plugin configuration or undefined if not found
     */
    getPluginConfig(pluginId: string): PluginConfig | undefined {
        const registration = this.plugins.get(pluginId);
        return registration?.config;
    }

    /**
     * Get a plugin's character IDs
     * 
     * @param pluginId Plugin ID
     * @returns Array of character IDs loaded for this plugin
     */
    getPluginCharacterIds(pluginId: string): string[] {
        const registration = this.plugins.get(pluginId);
        return registration?.characterIds || [];
    }

    /**
     * Find plugin for intent
     * 
     * @param intent Intent to find plugin for
     * @returns Plugin that can handle the intent or undefined if not found
     */
    findPluginForIntent(intent: Intent): IPlugin | undefined {
        // This is a simple implementation that just matches the prefix
        // A more robust implementation would use a proper intent filter system
        const intentAction = intent.action;
        const parts = intentAction.split(':');

        if (parts.length === 0) {
            return undefined;
        }

        // Try to find a plugin with a matching ID (first part of intent action)
        const pluginId = parts[0];
        const registration = this.plugins.get(pluginId);

        if (registration && registration.plugin.supportedIntents().includes(intentAction)) {
            return registration.plugin;
        }

        // If no match by ID, check all plugins for supported intents
        for (const [id, reg] of this.plugins.entries()) {
            if (reg.plugin.supportedIntents().includes(intentAction)) {
                return reg.plugin;
            }
        }

        return undefined;
    }

    /**
     * Execute an intent
     * 
     * @param intent Intent to execute
     * @param context Request context
     * @returns Execution result
     */
    async executeIntent(intent: Intent, context: RequestContext): Promise<PluginResult> {
        const plugin = this.findPluginForIntent(intent);

        if (!plugin) {
            return {
                success: false,
                error: `No plugin found to handle intent: ${intent.action}`
            };
        }

        try {
            return await plugin.execute(intent, context);
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
} 