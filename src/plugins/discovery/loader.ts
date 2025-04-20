/**
 * Plugin Discovery System - Plugin Loader
 * 
 * Responsible for scanning directories for plugin manifests
 * and loading plugin modules dynamically.
 */

import * as fs from 'fs';
import * as path from 'path';
import { IPlugin } from '../../mcp/interfaces/plugin';
import { PluginManifest, PluginRegistrationInfo } from './manifest';

/**
 * Plugin loader options
 */
export interface PluginLoaderOptions {
    /**
     * List of directories to scan for plugins
     */
    directories: string[];

    /**
     * Whether to load system plugins
     */
    loadSystemPlugins?: boolean;

    /**
     * Whether to load user plugins
     */
    loadUserPlugins?: boolean;

    /**
     * Logger instance
     */
    logger?: any;
}

/**
 * Result of loading a plugin
 */
export interface PluginLoadResult {
    /**
     * Plugin instance
     */
    plugin: IPlugin;

    /**
     * Plugin registration info
     */
    info: PluginRegistrationInfo;
}

/**
 * Plugin loader class
 * Responsible for discovering and loading plugins
 */
export class PluginLoader {
    private directories: string[];
    private logger: any;
    private loadSystemPlugins: boolean;
    private loadUserPlugins: boolean;

    constructor(options: PluginLoaderOptions) {
        this.directories = options.directories;
        this.loadSystemPlugins = options.loadSystemPlugins ?? true;
        this.loadUserPlugins = options.loadUserPlugins ?? true;
        this.logger = options.logger || console;
    }

    /**
     * Scan directories for plugin manifests and load plugins
     */
    async loadPlugins(): Promise<PluginLoadResult[]> {
        const results: PluginLoadResult[] = [];
        const registrationInfo = await this.scanDirectories();

        for (const info of registrationInfo) {
            try {
                if ((info.isSystem && !this.loadSystemPlugins) ||
                    (!info.isSystem && !this.loadUserPlugins)) {
                    this.logger.debug(`Skipping plugin ${info.id} (${info.isSystem ? 'system' : 'user'})`);
                    continue;
                }

                const plugin = await this.loadPlugin(info);
                if (plugin) {
                    results.push({ plugin, info });
                    this.logger.info(`Loaded plugin: ${info.id} (${info.manifest.name})`);
                }
            } catch (error) {
                this.logger.error(`Failed to load plugin ${info.id}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        return results;
    }

    /**
     * Scan directories for plugin manifests
     */
    private async scanDirectories(): Promise<PluginRegistrationInfo[]> {
        const results: PluginRegistrationInfo[] = [];

        for (const directory of this.directories) {
            try {
                if (!fs.existsSync(directory)) {
                    this.logger.warn(`Plugin directory does not exist: ${directory}`);
                    continue;
                }

                const isSystemDirectory = directory.includes('system') ||
                    !directory.includes('custom');

                const entries = fs.readdirSync(directory, { withFileTypes: true });

                for (const entry of entries) {
                    if (!entry.isDirectory()) continue;

                    const pluginDir = path.join(directory, entry.name);
                    const manifestPath = path.join(pluginDir, 'manifest.json');

                    if (!fs.existsSync(manifestPath)) {
                        this.logger.debug(`No manifest found in ${pluginDir}`);
                        continue;
                    }

                    try {
                        const manifestContent = fs.readFileSync(manifestPath, 'utf8');
                        const manifest = JSON.parse(manifestContent) as PluginManifest;

                        if (!manifest.id || !manifest.entryPoint) {
                            this.logger.warn(`Invalid manifest in ${manifestPath}: missing required fields`);
                            continue;
                        }

                        if (!manifest.enabled) {
                            this.logger.debug(`Plugin ${manifest.id} is disabled, skipping`);
                            continue;
                        }

                        results.push({
                            id: manifest.id,
                            manifest,
                            pluginPath: pluginDir,
                            isSystem: isSystemDirectory
                        });

                        this.logger.debug(`Found plugin: ${manifest.id} at ${pluginDir}`);
                    } catch (error) {
                        this.logger.error(`Error parsing manifest at ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`);
                    }
                }
            } catch (error) {
                this.logger.error(`Error scanning directory ${directory}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        return results;
    }

    /**
     * Load a plugin module
     */
    private async loadPlugin(info: PluginRegistrationInfo): Promise<IPlugin | null> {
        const { manifest, pluginPath } = info;
        const entryPointPath = path.join(pluginPath, manifest.entryPoint);

        try {
            // Check if entry point exists
            if (!fs.existsSync(entryPointPath)) {
                throw new Error(`Entry point not found: ${entryPointPath}`);
            }

            // Import the module
            const pluginModule = await import(entryPointPath);

            // Find the plugin class
            const PluginClass = this.findPluginClass(pluginModule);
            if (!PluginClass) {
                throw new Error(`No plugin class found in ${entryPointPath}`);
            }

            // Instantiate the plugin
            const plugin = new PluginClass({
                logger: this.logger,
                config: manifest.config
            });

            return plugin;
        } catch (error) {
            this.logger.error(`Failed to load plugin from ${entryPointPath}: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }

    /**
     * Find the plugin class in the imported module
     */
    private findPluginClass(module: any): any {
        // Look for a class that implements IPlugin
        for (const key in module) {
            const exported = module[key];
            if (typeof exported === 'function' &&
                exported.prototype &&
                typeof exported.prototype.supportedIntents === 'function') {
                return exported;
            }
        }
        return null;
    }
} 