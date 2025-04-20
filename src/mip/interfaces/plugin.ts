import { Intent } from '../intent';

export interface RequestContext {
    requestId: string;
    userId: string;
    mip: any;
}

export interface PluginResult {
    success: boolean;
    data?: any;
    error?: string;
}

export interface IPlugin {
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    execute(intent: Intent, context: RequestContext): Promise<PluginResult>;
    canHandle(intent: Intent): boolean;
    supportedIntents(): string[];
} 