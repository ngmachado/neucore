import { MCP } from './mcp/mcp';
import { MemoryManager } from './core/memory/memoryManager';
import { getLogger } from './core/logging';
import { AlfafrensPlugin } from './plugins/alfafrensPlugin';
import { CharacterPlugin } from './plugins/characterPlugin';
import { ReasoningPlugin } from './plugins/reasoningPlugin';
import { ContextPlugin } from './plugins/contextPlugin';
import { TemplatePlugin } from './plugins/templatePlugin';
import { Intent } from './mcp/intent';
import { LogLevel } from './types';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { createProviderFactory } from './core/providers';

// Load environment variables
dotenv.config();

// Create a simple logger with log method compatible with AlfafrensPlugin
const rawLogger = getLogger('neurocore-app');
const logger = {
    debug: (...args: any[]) => rawLogger.debug(args[0], ...args.slice(1)),
    info: (...args: any[]) => rawLogger.info(args[0], ...args.slice(1)),
    warn: (...args: any[]) => rawLogger.warn(args[0], ...args.slice(1)),
    error: (...args: any[]) => rawLogger.error(args[0], ...args.slice(1)),
    log: (level: LogLevel, message: string, ...args: any[]) => {
        switch (level) {
            case LogLevel.DEBUG:
                rawLogger.debug(message, ...args);
                break;
            case LogLevel.INFO:
                rawLogger.info(message, ...args);
                break;
            case LogLevel.WARN:
                rawLogger.warn(message, ...args);
                break;
            case LogLevel.ERROR:
                rawLogger.error(message, ...args);
                break;
            default:
                rawLogger.info(message, ...args);
        }
    }
};

// Ensure plugin config directory exists
const configDir = path.join(__dirname, 'plugins');
if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
}

// Create plugin config if it doesn't exist
const configPath = path.join(configDir, 'plugin-config.json');
if (!fs.existsSync(configPath)) {
    const defaultConfig = {
        plugins: {
            alfafrens: {
                enabled: true,
                apiKey: process.env.ALFAFRENS_API_KEY || '',
                userId: process.env.ALFAFRENS_USER_ID || 'bot',
                channelId: process.env.ALFAFRENS_CHANNEL_ID || 'general',
                username: process.env.ALFAFRENS_USERNAME || 'NeurocoreBot',
                pollInterval: Number(process.env.ALFAFRENS_POLL_INTERVAL || 30),
                enablePost: Boolean(process.env.ALFAFRENS_ENABLE_POST || false),
                postIntervalMin: Number(process.env.ALFAFRENS_POST_INTERVAL_MIN || 3600),
                postIntervalMax: Number(process.env.ALFAFRENS_POST_INTERVAL_MAX || 7200)
            }
        }
    };
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    logger.info(`Created default plugin config at ${configPath}`);
}

// Initialize the system
async function initializeSystem() {
    logger.info('Initializing Neurocore system...');

    // Set up memory manager
    const memoryManager = new MemoryManager({
        tableName: 'memories',
        runtime: {
            endpoint: process.env.RUNTIME_ENDPOINT || 'http://localhost:3000',
            apiKey: process.env.RUNTIME_API_KEY || 'dev-key'
        }
    });

    // Create AI provider factory
    const providerConfig: {
        openai?: {
            apiKey: string;
            defaultModel?: string;
            endpoint?: string;
        };
        anthropic?: {
            apiKey: string;
            defaultModel?: string;
        };
        defaultProvider?: 'openai' | 'anthropic';
    } = {};

    // Set up OpenAI if API key is available
    if (process.env.OPENAI_API_KEY) {
        providerConfig.openai = {
            apiKey: process.env.OPENAI_API_KEY,
            defaultModel: process.env.OPENAI_DEFAULT_MODEL || 'gpt-4o',
            endpoint: process.env.OPENAI_API_ENDPOINT || 'https://api.openai.com/v1'
        };
        logger.info('OpenAI provider configured');
    }

    // Set up Anthropic if API key is available
    if (process.env.ANTHROPIC_API_KEY) {
        providerConfig.anthropic = {
            apiKey: process.env.ANTHROPIC_API_KEY,
            defaultModel: process.env.ANTHROPIC_DEFAULT_MODEL || 'claude-3-opus-20240229'
        };
        logger.info('Anthropic provider configured');
    }

    // Determine default provider based on available keys
    if (providerConfig.openai || providerConfig.anthropic) {
        providerConfig.defaultProvider = providerConfig.openai ? 'openai' : 'anthropic';
        logger.info(`Using ${providerConfig.defaultProvider} as the default AI provider`);
    } else {
        logger.warn('No AI provider keys found. Reasoning capabilities will be limited.');
    }

    let providerFactory;
    try {
        providerFactory = createProviderFactory(providerConfig);
        logger.info(`Provider factory created with providers: ${providerFactory.getAvailableProviders().join(', ')}`);
    } catch (error) {
        logger.error(`Failed to create provider factory: ${error instanceof Error ? error.message : String(error)}`);
        logger.warn('AI reasoning capabilities will be limited');
    }

    // Initialize MCP
    const mcp = new MCP();
    await mcp.initialize();

    // Register required plugins first
    try {
        // Create and register the CharacterPlugin
        const characterPlugin = new CharacterPlugin({
            logger,
            providerFactory,
            config: {
                charactersDir: path.join(__dirname, '..', 'data', 'characters')
            }
        });
        mcp.registerPlugin(characterPlugin);
        await characterPlugin.initialize();
        logger.info('Character plugin registered and initialized');

        // Create and register the ReasoningPlugin with provider factory
        const reasoningPlugin = new ReasoningPlugin({
            logger,
            providerFactory,
            config: {
                defaultModel: providerConfig.openai ? 'gpt-4o' : 'claude-3-opus-20240229'
            }
        });
        mcp.registerPlugin(reasoningPlugin);
        await reasoningPlugin.initialize();
        logger.info('Reasoning plugin registered and initialized');

        // Create and register the ContextPlugin
        const contextPlugin = new ContextPlugin({
            logger
        });
        mcp.registerPlugin(contextPlugin);
        await contextPlugin.initialize();
        logger.info('Context plugin registered and initialized');

        // Create and register the TemplatePlugin
        const templatePlugin = new TemplatePlugin({
            logger
        });
        mcp.registerPlugin(templatePlugin);
        await templatePlugin.initialize();
        logger.info('Template plugin registered and initialized');

        // Create the Alfafrens plugin
        const alfafrensPlugin = new AlfafrensPlugin({
            memoryManager,
            logger,
            mcp,
            config: {
                apiKey: process.env.ALFAFRENS_API_KEY || '',
                userId: process.env.ALFAFRENS_USER_ID || '56f9388e-7722-4cf5-872a-086cb31938e7',
                channelId: process.env.ALFAFRENS_CHANNEL_ID || 'general',
                username: process.env.ALFAFRENS_USERNAME || 'NeurocoreBot',
                pollInterval: Number(process.env.ALFAFRENS_POLL_INTERVAL || 30),
                enablePost: Boolean(process.env.ALFAFRENS_ENABLE_POST || false),
                postIntervalMin: Number(process.env.ALFAFRENS_POST_INTERVAL_MIN || 3600),
                postIntervalMax: Number(process.env.ALFAFRENS_POST_INTERVAL_MAX || 7200)
            }
        });

        // Register the plugin with MCP
        mcp.registerPlugin(alfafrensPlugin);
        logger.info('Alfafrens plugin registered');

        // Initialize Alfafrens plugin
        await alfafrensPlugin.initialize();
        logger.info('Alfafrens plugin initialized');

        // Start Alfafrens polling
        const intent = new Intent({
            action: 'alfafrens:startPolling',
            data: {
                interval: parseInt(process.env.POLLING_INTERVAL || '5000')
            }
        });

        const result = await mcp.executeIntent(intent);
        if (result.success) {
            logger.info('Alfafrens polling started');
        } else {
            logger.error(`Failed to start Alfafrens polling: ${result.error}`);
        }

    } catch (error) {
        logger.error(`Failed to register plugins: ${error instanceof Error ? error.message : String(error)}`);
    }

    return { mcp, memoryManager };
}

// Start the system
async function start() {
    try {
        const { mcp } = await initializeSystem();
        logger.info('Neurocore system started successfully');

        // Handle shutdown
        process.on('SIGINT', async () => {
            logger.info('Shutting down Neurocore system...');
            await mcp.shutdown();
            process.exit(0);
        });

    } catch (error) {
        logger.error(`Failed to start Neurocore system: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
    }
}

// Only start if this file is run directly
if (require.main === module) {
    start();
}

export { initializeSystem }; 