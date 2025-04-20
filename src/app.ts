import { MCP } from './mcp/mcp';
import { MemoryManager } from './core/memory/memoryManager';
import { getLogger } from './core/logging';
import { CharacterPlugin } from './plugins/characterPlugin';
import { ReasoningPlugin } from './plugins/reasoningPlugin';
import { ContextPlugin } from './plugins/contextPlugin';
import { TemplatePlugin } from './plugins/templatePlugin';
import { DirectChatPlugin } from './plugins/directChatPlugin';
import { Intent } from './mcp/intent';
import { LogLevel } from './types';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { createProviderFactory } from './core/providers';
import { DatabasePlugin } from './plugins/databasePlugin';
import { DatabaseConfig } from './database/interfaces';
import { DocumentManagerPlugin } from './plugins/documentManagerPlugin';
import { KnowledgeProcessor } from './core/knowledge/knowledgeProcessor';
import { IntentActionBridge } from './core/actions/intentActionBridge';

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
            // Removed Alfafrens config
        }
    };
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    logger.info(`Created default plugin config at ${configPath}`);
}

// Initialize the system
async function initializeSystem() {
    logger.info('Initializing Neurocore system...');

    try {
        // Initialize MCP without knowledge processing initially
        const mcp = new MCP({
            // Removing knowledge processing to avoid errors
            // We'll set it up after plugins are registered
        });
        await mcp.initialize();
        logger.info('MCP initialized');

        // Initialize database
        const dbConfig: DatabaseConfig = {
            path: process.env.DATABASE_PATH || 'data/neurocore.db',
            options: {
                memory: process.env.DATABASE_MEMORY === 'true',
                readonly: process.env.DATABASE_READONLY === 'true',
                fileMustExist: process.env.DATABASE_FILE_MUST_EXIST === 'true',
                timeout: parseInt(process.env.DATABASE_TIMEOUT || '5000'),
                verbose: process.env.DATABASE_VERBOSE === 'true'
            }
        };

        const dbPlugin = new DatabasePlugin(dbConfig);
        await dbPlugin.initialize();
        mcp.registerPlugin(dbPlugin);
        logger.info('Database plugin registered and initialized');

        // Create and register DocumentManagerPlugin
        const docManagerPlugin = new DocumentManagerPlugin({
            dbPath: dbConfig.path
        });
        await docManagerPlugin.initialize();
        mcp.registerPlugin(docManagerPlugin);
        logger.info('Document manager plugin registered and initialized');

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
                logger,
                mcp
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

            // Create and register the DirectChatPlugin for testing UI
            const directChatPlugin = new DirectChatPlugin({
                logger,
                mcp,
                config: {
                    defaultCharacterName: "Assistant"
                }
            });
            mcp.registerPlugin(directChatPlugin);
            logger.info('DirectChat plugin registered');

            // Now that all plugins are registered, set up knowledge processing
            try {
                // Process knowledge from README and docs
                logger.info('Processing knowledge from README and docs');

                // Get the knowledge processor from MCP
                const knowledgeProcessor = mcp.getKnowledgeProcessor();

                if (!knowledgeProcessor) {
                    logger.warn('Knowledge processor not available, skipping knowledge processing');
                } else {
                    // Process README.md
                    const readmePath = path.join(__dirname, '../README.md');
                    if (fs.existsSync(readmePath)) {
                        logger.info(`Loading knowledge from README.md`);
                        const readmeContent = fs.readFileSync(readmePath, 'utf8');
                        await knowledgeProcessor.processStringKnowledge(readmeContent, {
                            type: 'markdown',
                            metadata: {
                                title: 'NeuroCore README',
                                source: 'README.md'
                            }
                        });
                        logger.info(`README.md processed successfully`);
                    } else {
                        logger.warn(`README.md not found at ${readmePath}`);
                    }

                    // Process documentation files
                    const docsDir = path.join(__dirname, '../docs');
                    if (fs.existsSync(docsDir)) {
                        logger.info(`Loading knowledge from docs directory`);
                        const docFiles = fs.readdirSync(docsDir)
                            .filter(file => file.endsWith('.md'));

                        for (const file of docFiles) {
                            logger.info(`Processing ${file}`);
                            const filePath = path.join(docsDir, file);
                            const content = fs.readFileSync(filePath, 'utf8');
                            await knowledgeProcessor.processStringKnowledge(content, {
                                type: 'markdown',
                                metadata: {
                                    title: `NeuroCore Documentation: ${file}`,
                                    source: `docs/${file}`
                                }
                            });
                            logger.info(`${file} processed successfully`);
                        }
                        logger.info(`Docs directory processed successfully (${docFiles.length} files)`);
                    } else {
                        logger.warn(`Docs directory not found at ${docsDir}`);
                    }

                    logger.info('Knowledge processing completed.');
                }
            } catch (error) {
                logger.error(`Knowledge processing error: ${error instanceof Error ? error.message : String(error)}`);
            }

        } catch (error) {
            logger.error(`Failed to register plugins: ${error instanceof Error ? error.message : String(error)}`);
        }

        return { mcp, memoryManager };
    } catch (error) {
        logger.error('Failed to initialize system:', error);
        throw error;
    }
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