import { Intent } from '../intent';

export interface IPlugin {
    name: string;
    version: string;
    description: string;
    canHandle(intent: Intent): boolean;
    execute(intent: Intent, context: any): Promise<any>;
} 