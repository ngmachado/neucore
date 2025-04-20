/**
 * Neurocore Plugins
 */

import { PluginManager } from '../mcp/pluginManager';
import { AlfafrensPlugin } from './alfafrens';
import { MCP } from '../mcp/mcp';
import { DatabasePlugin } from './databasePlugin';
import { DocumentManagerPlugin } from './documentManagerPlugin';
import { CharacterPlugin } from './characterPlugin';
import { ReasoningPlugin } from './reasoningPlugin';
import { ContextPlugin } from './contextPlugin';
import { TemplatePlugin } from './templatePlugin';
import { DirectChatPlugin } from './directChatPlugin';
import { RelationshipPlugin } from './relationshipPlugin';

// Export all plugins
export { AlfafrensPlugin } from './alfafrens';
export { DatabasePlugin } from './databasePlugin';
export { DocumentManagerPlugin } from './documentManagerPlugin';
export { CharacterPlugin } from './characterPlugin';
export { ReasoningPlugin } from './reasoningPlugin';
export { ContextPlugin } from './contextPlugin';
export { TemplatePlugin } from './templatePlugin';
export { DirectChatPlugin } from './directChatPlugin';
export { RelationshipPlugin } from './relationshipPlugin';

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