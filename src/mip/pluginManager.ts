import { IPlugin } from './interfaces/plugin';
import { Intent } from './intent';

export class PluginManager {
    private plugins: Map<string, IPlugin> = new Map();

    register(plugin: IPlugin): void {
        this.plugins.set(plugin.name, plugin);
    }

    unregister(pluginName: string): void {
        this.plugins.delete(pluginName);
    }

    getPluginForIntent(intent: Intent): IPlugin | undefined {
        return Array.from(this.plugins.values()).find(plugin => plugin.canHandle(intent));
    }
} 