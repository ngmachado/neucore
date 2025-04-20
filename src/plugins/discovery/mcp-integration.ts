/**
 * Plugin Discovery System - MCP Integration
 * 
 * Initializes the MCP with the plugin discovery system.
 */

import * as path from 'path';
import { MCP } from '../../mcp/mcp';
import { PluginDiscovery } from './index';
import { getLogger } from '../../core/logging';
import { PluginDiscoveryConfig } from './config';
import { Intent } from '../../mcp/intent';
import { IPlugin } from '../../mcp/interfaces/plugin';

/**
 * Initialize MCP with the plugin discovery system
 */
export async function initializeWithDiscovery(
    config: PluginDiscoveryConfig
): Promise<MCP> {
    const logger = getLogger('plugin-discovery');

    // Create new MCP instance
    const mcp = new MCP();

    // Make MCP available globally for adapter plugins
    (global as any).mcpInstance = mcp;

    if (!config.enabled) {
        logger.info('Plugin discovery system is disabled');
        return mcp;
    }

    // Create plugin discovery system
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

    // Initialize the discovery system and load plugins
    await discovery.initialize();

    // Register discovered plugins with MCP
    const plugins = discovery.getAllPlugins();
    for (const [id, plugin] of plugins.entries()) {
        await mcp.registerPlugin(plugin);
        logger.info(`Registered discovered plugin: ${id}`);
    }

    // Initialize MCP
    await mcp.initialize();

    logger.info('MCP initialized with plugin discovery system');
    return mcp;
}

/**
 * Example usage
 */
/*
// In your app's entry point:
import { initializeWithDiscovery } from './plugins/discovery/mcp-integration';
import { PluginDiscoveryConfig } from './plugins/discovery/config';
import * as path from 'path';

async function startApplication() {
  // Configure discovery system
  const discoveryConfig: PluginDiscoveryConfig = {
    enabled: true,
    systemDirectory: path.join(__dirname, 'plugins', 'system'),
    userDirectory: path.join(__dirname, 'plugins', 'custom'),
    usePriorityResolver: true,
    loadSystemPlugins: true,
    loadUserPlugins: true,
    debug: true
  };
  
  // Initialize MCP with discovery
  const mcp = await initializeWithDiscovery(discoveryConfig);
  
  // Now use MCP as usual
  await mcp.executeIntent(new Intent('directChat:message', {
    message: 'Hello, world!'
  }));
}

startApplication().catch(console.error);
*/ 