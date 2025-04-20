/**
 * Plugin Discovery System - Integration
 */

import * as path from 'path';
import { MCP } from '../../mcp/mcp';
import { PluginDiscovery } from './index';
import { getLogger } from '../../core/logging';
import { PluginDiscoveryConfig } from './config';
import { Intent } from '../../mcp/intent';
import { IPlugin } from '../../mcp/interfaces/plugin';

/**
 * Enable the plugin discovery system in MCP
 */
export async function enablePluginDiscovery(mcp: MCP, config: PluginDiscoveryConfig): Promise<void> {
    const logger = getLogger('plugin-discovery');

    if (!config.enabled) {
        logger.info('Plugin discovery system is disabled');
        return;
    }

    // Create the plugin discovery system directly
    const discovery = new PluginDiscovery({
        systemPluginDirectory: config.systemDirectory,
        userPluginDirectory: config.userDirectory,
        intentHandlerConfig: {
            intentHandlers: config.intentHandlers || {}
        },
        usePriorityResolver: config.usePriorityResolver ?? true,
        loadSystemPlugins: config.loadSystemPlugins ?? true,
        loadUserPlugins: config.loadUserPlugins ?? true,
        debug: config.debug ?? false,
        enabled: true,
        logger
    });

    // Initialize the discovery system
    await discovery.initialize();

    // Store original methods
    const originalMethods = {
        registerPlugin: mcp.registerPlugin.bind(mcp),
        executeIntent: mcp.executeIntent.bind(mcp),
    };

    // Override methods to use our discovery system
    mcp.registerPlugin = async (plugin: IPlugin): Promise<void> => {
        // Register with the original MCP first
        await originalMethods.registerPlugin(plugin);

        // Note: The discovery system loads plugins from manifests,
        // so we don't need to register programmatic plugins directly
        logger.debug(`Plugin registered via original method: ${plugin.supportedIntents()[0]}`);
    };

    mcp.executeIntent = async (intent: Intent): Promise<any> => {
        // Try to find a plugin using the discovery system first
        const plugin = discovery.findPluginForIntent(intent);
        if (plugin) {
            logger.debug(`Executing intent ${intent.action} with discovery plugin`);
            return await plugin.execute(intent, {
                requestId: 'discovery-' + Date.now(),
                userId: 'system',
                mcp
            });
        }

        // Fall back to original implementation if no plugin found
        logger.debug(`Falling back to original implementation for intent ${intent.action}`);
        return originalMethods.executeIntent(intent);
    };

    logger.info('Plugin discovery system integrated with MCP');
}

/**
 * Example usage
 */
/* 
// In app.ts or where MCP is initialized:
import { enablePluginDiscovery } from './plugins/discovery/integration';
import { PluginDiscoveryConfig } from './plugins/discovery/config';

async function initializeSystem() {
  // Initialize MCP
  const mcp = new MCP();
  await mcp.initialize();
  
  // Configure and enable plugin discovery
  const discoveryConfig: PluginDiscoveryConfig = {
    enabled: true,
    systemDirectory: path.join(__dirname, 'plugins', 'system'),
    userDirectory: path.join(__dirname, 'plugins', 'custom'),
    usePriorityResolver: true,
    loadSystemPlugins: true,
    loadUserPlugins: true,
    debug: true
  };
  
  await enablePluginDiscovery(mcp, discoveryConfig);
  
  // Continue with other initialization...
}
*/ 