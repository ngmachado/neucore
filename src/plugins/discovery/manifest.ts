/**
 * Plugin Discovery System - Manifest Definitions
 * 
 * Defines interfaces for plugin manifests that support auto-discovery
 * and priority-based intent resolution.
 */

import { UUID } from '../../types';

/**
 * Plugin intent handler configuration
 */
export interface IntentHandlerConfig {
    /**
     * Priority level for this intent handler
     * Higher values take precedence over lower values
     * System plugins typically use 0, user plugins use higher values
     */
    priority: number;

    /**
     * Whether this intent handler is enabled
     */
    enabled: boolean;
}

/**
 * Plugin manifest definition
 */
export interface PluginManifest {
    /**
     * Unique identifier for the plugin
     */
    id: string;

    /**
     * Human-readable name of the plugin
     */
    name: string;

    /**
     * Plugin version
     */
    version: string;

    /**
     * Path to the plugin entry point (relative to manifest location)
     */
    entryPoint: string;

    /**
     * Whether the plugin is enabled
     */
    enabled: boolean;

    /**
     * IDs of system plugins this plugin substitutes
     * If specified, this plugin will replace the functionality
     * of the specified system plugins
     */
    substitutes?: string[];

    /**
     * Intent handler configuration
     * Maps intent actions to their handler configuration
     */
    intentMapping: {
        [intentAction: string]: IntentHandlerConfig;
    };

    /**
     * Additional plugin-specific configuration
     */
    config?: Record<string, any>;
}

/**
 * Plugin registration information (internal use)
 */
export interface PluginRegistrationInfo {
    /**
     * Plugin ID
     */
    id: string;

    /**
     * Plugin manifest
     */
    manifest: PluginManifest;

    /**
     * Absolute path to the plugin directory
     */
    pluginPath: string;

    /**
     * Whether this is a system plugin (built-in)
     */
    isSystem: boolean;
} 