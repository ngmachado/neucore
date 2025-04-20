import { IPlugin, PluginResult, RequestContext } from '../mcp/interfaces/plugin';
import { Intent } from '../mcp/intent';
import { SQLiteAdapter } from '../database/adapters/sqlite';
import { getLogger } from '../core/logging';

// Define the DatabaseConfig interface locally
interface DatabaseConfig {
    path: string;
}

const logger = getLogger('database-plugin');

export class DatabasePlugin implements IPlugin {
    private adapter: SQLiteAdapter;
    private initialized = false;
    public supportedIntents(): string[] {
        return [
            'database:query',
            'database:execute',
            'database:transaction',
            'database:status'
        ];
    }

    constructor(config: DatabaseConfig) {
        this.adapter = new SQLiteAdapter(config);
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            await this.adapter.connect();
            this.initialized = true;
            logger.info('Database plugin initialized');
        } catch (error) {
            logger.error('Failed to initialize database plugin:', error);
            throw error;
        }
    }

    async shutdown(): Promise<void> {
        if (!this.initialized) return;

        try {
            await this.adapter.disconnect();
            this.initialized = false;
            logger.info('Database plugin shut down');
        } catch (error) {
            logger.error('Failed to shut down database plugin:', error);
            throw error;
        }
    }

    async execute(intent: Intent, context: RequestContext): Promise<PluginResult> {
        if (!this.initialized) {
            throw new Error('Database plugin not initialized');
        }

        try {
            switch (intent.action) {
                case 'database:query':
                    return { success: true, data: await this.adapter.executeQuery(intent.data.query, intent.data.params) };
                case 'database:execute':
                    // Use the run method for non-SELECT operations
                    await this.adapter.executeRun(intent.data.query, intent.data.params);
                    return { success: true, data: { affected: 1 } };
                case 'database:transaction':
                    // For transactions, determine if each operation is a query or run
                    const results = [];
                    for (const op of intent.data.operations) {
                        if (op.query.trim().toUpperCase().startsWith('SELECT')) {
                            results.push(await this.adapter.executeQuery(op.query, op.params));
                        } else {
                            await this.adapter.executeRun(op.query, op.params);
                            results.push({ affected: 1 });
                        }
                    }
                    return { success: true, data: results };
                case 'database:status':
                    return { success: true, data: await this.adapter.getStatus() };
                default:
                    throw new Error(`Unsupported intent action: ${intent.action}`);
            }
        } catch (error) {
            logger.error(`Failed to execute database intent ${intent.action}:`, error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    }

    canHandle(intent: Intent): boolean {
        return intent.action.startsWith('database:');
    }
} 