import { IPlugin } from '../mcp/interfaces/plugin';
import { Intent } from '../mcp/intent';
import { MIPIntent } from './interfaces/intent';

export class PluginManager {
    private plugins: IPlugin[] = [];

    registerPlugin(plugin: IPlugin): void {
        this.plugins.push(plugin);
    }

    /**
     * Find a plugin that can handle the given intent action
     * @param intentOrAction Either an intent object or action string
     * @returns The first plugin that supports the intent action, or undefined if none found
     */
    findPluginForIntent(intentOrAction: Intent | MIPIntent | string): IPlugin | undefined {
        // Extract the action string from the intent if an object was provided
        const action = typeof intentOrAction === 'string'
            ? intentOrAction
            : intentOrAction.action;

        return this.plugins.find(plugin => plugin.supportedIntents().includes(action));
    }
} 