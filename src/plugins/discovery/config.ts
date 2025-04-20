/**
 * Plugin Discovery System - Configuration
 */

export interface PluginDiscoveryConfig {
    /**
     * Whether the discovery system is enabled
     */
    enabled: boolean;

    /**
     * Path to system plugins directory
     */
    systemDirectory: string;

    /**
     * Path to user plugins directory
     */
    userDirectory: string;

    /**
     * Whether to load system plugins
     */
    loadSystemPlugins?: boolean;

    /**
     * Whether to load user plugins
     */
    loadUserPlugins?: boolean;

    /**
     * User-defined intent handler overrides
     */
    intentHandlers?: {
        [intentAction: string]: string;
    };

    /**
     * Whether to use the new priority-based resolver
     */
    usePriorityResolver?: boolean;

    /**
     * Whether to log debug information
     */
    debug?: boolean;
} 