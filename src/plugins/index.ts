/**
 * Neurocore Plugins
 */

import { PluginManager } from '../mcp/pluginManager';
import { AlfafrensPlugin } from './alfafrensPlugin';
import { MCP } from '../mcp/mcp';

export { AlfafrensPlugin } from './alfafrensPlugin';

/**
 * Register the Alfafrens plugin with the plugin manager
 */
export function registerAlfafrensPlugin(
    pluginManager: PluginManager,
    options: {
        memoryManager: any;
        logger: any;
        mcp: MCP;
        config?: any;
    }
): void {
    const alfafrensPlugin = new AlfafrensPlugin(options);
    pluginManager.registerPlugin(alfafrensPlugin);
} 