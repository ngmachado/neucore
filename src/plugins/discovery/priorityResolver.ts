/**
 * Plugin Discovery System - Priority-based Intent Resolver
 * 
 * Responsible for resolving which plugin should handle a given intent
 * based on priority settings and user preferences.
 */

import { Intent } from '../../mcp/intent';
import { IPlugin } from '../../mcp/interfaces/plugin';
import { PluginLoadResult } from './loader';

/**
 * Intent handler mapping configuration
 */
export interface IntentHandlerMappingConfig {
    /**
     * User-defined overrides for intent handlers
     * Maps intent actions to plugin IDs
     */
    intentHandlers?: {
        [intentAction: string]: string;
    };
}

/**
 * Priority-based intent resolver options
 */
export interface PriorityResolverOptions {
    /**
     * User configuration for intent handler mappings
     */
    config?: IntentHandlerMappingConfig;

    /**
     * Logger instance
     */
    logger?: any;
}

/**
 * Priority-based intent resolver
 * Resolves which plugin should handle a given intent based on priority
 */
export class PriorityResolver {
    private loadedPlugins: Map<string, PluginLoadResult> = new Map();
    private intentToPluginMap: Map<string, string[]> = new Map();
    private config: IntentHandlerMappingConfig;
    private logger: any;

    constructor(options: PriorityResolverOptions = {}) {
        this.config = options.config || { intentHandlers: {} };
        this.logger = options.logger || console;
    }

    /**
     * Register loaded plugins with the resolver
     */
    registerPlugins(plugins: PluginLoadResult[]): void {
        // Store plugins by ID
        for (const result of plugins) {
            this.loadedPlugins.set(result.info.id, result);
        }

        // Build mapping of intents to plugins
        this.buildIntentMap();

        this.logger.info(`Registered ${plugins.length} plugins with resolver`);
    }

    /**
     * Find the appropriate plugin to handle an intent
     */
    resolvePluginForIntent(intent: Intent): IPlugin | undefined {
        const intentAction = intent.action;

        // Check for user-defined override
        if (this.config.intentHandlers && this.config.intentHandlers[intentAction]) {
            const pluginId = this.config.intentHandlers[intentAction];
            const result = this.loadedPlugins.get(pluginId);

            if (result) {
                this.logger.debug(`Using user-defined handler for ${intentAction}: ${pluginId}`);
                return result.plugin;
            } else {
                this.logger.warn(`User-defined handler ${pluginId} for ${intentAction} not found`);
            }
        }

        // Get list of plugins that support this intent
        const pluginIds = this.intentToPluginMap.get(intentAction);
        if (!pluginIds || pluginIds.length === 0) {
            return undefined;
        }

        // If only one plugin, use it
        if (pluginIds.length === 1) {
            return this.loadedPlugins.get(pluginIds[0])?.plugin;
        }

        // Find plugin with highest priority for this intent
        let highestPriority = -1;
        let selectedPluginId: string | undefined;

        for (const pluginId of pluginIds) {
            const result = this.loadedPlugins.get(pluginId);
            if (!result) continue;

            const { manifest } = result.info;
            const intentConfig = manifest.intentMapping[intentAction];

            if (intentConfig && intentConfig.enabled && intentConfig.priority > highestPriority) {
                highestPriority = intentConfig.priority;
                selectedPluginId = pluginId;
            }
        }

        if (selectedPluginId) {
            this.logger.debug(`Resolved handler for ${intentAction}: ${selectedPluginId} (priority ${highestPriority})`);
            return this.loadedPlugins.get(selectedPluginId)?.plugin;
        }

        return undefined;
    }

    /**
     * Check if a plugin is substituted by another plugin
     */
    isPluginSubstituted(pluginId: string): boolean {
        for (const [id, result] of this.loadedPlugins.entries()) {
            if (id === pluginId) continue;

            const { manifest } = result.info;
            if (manifest.substitutes && manifest.substitutes.includes(pluginId)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get plugin that substitutes another plugin
     */
    getSubstitutingPlugin(pluginId: string): IPlugin | undefined {
        for (const [id, result] of this.loadedPlugins.entries()) {
            if (id === pluginId) continue;

            const { manifest } = result.info;
            if (manifest.substitutes && manifest.substitutes.includes(pluginId)) {
                return result.plugin;
            }
        }

        return undefined;
    }

    /**
     * Build mapping of intents to plugins
     */
    private buildIntentMap(): void {
        this.intentToPluginMap.clear();

        for (const [pluginId, result] of this.loadedPlugins.entries()) {
            const { plugin } = result;
            const supportedIntents = plugin.supportedIntents();

            for (const intent of supportedIntents) {
                if (!this.intentToPluginMap.has(intent)) {
                    this.intentToPluginMap.set(intent, []);
                }
                this.intentToPluginMap.get(intent)?.push(pluginId);
            }
        }

        // Log intent mapping information
        for (const [intent, plugins] of this.intentToPluginMap.entries()) {
            this.logger.debug(`Intent ${intent} can be handled by: ${plugins.join(', ')}`);
        }
    }
} 