import { IPlugin, PluginResult, RequestContext } from '../mcp/interfaces/plugin';
import { Intent } from '../mcp/intent';
import { UUID } from '../types';

/**
 * Simple relationship plugin to handle relationship-related intents
 */
export class RelationshipPlugin implements IPlugin {
    private initialized: boolean = false;
    private logger: any;
    private relationships: Map<string, any> = new Map();

    constructor(options: { logger: any }) {
        this.logger = options.logger;
    }

    /**
     * Get the ID of this plugin
     */
    public getId(): UUID {
        return 'relationship-plugin';
    }

    /**
     * Get the name of this plugin
     */
    public getName(): string {
        return 'Relationship Plugin';
    }

    /**
     * Check if this plugin can handle an intent
     */
    public canHandle(intent: Intent): boolean {
        return intent.action.startsWith('relationship:');
    }

    /**
     * Get the list of intents this plugin supports
     */
    public supportedIntents(): string[] {
        return [
            'relationship:create',
            'relationship:get',
            'relationship:update',
            'relationship:delete'
        ];
    }

    /**
     * Initialize the plugin
     */
    public async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        this.logger.info('Initializing RelationshipPlugin');
        this.initialized = true;
    }

    /**
     * Shutdown the plugin
     */
    public async shutdown(): Promise<void> {
        this.logger.info('Shutting down RelationshipPlugin');
        this.initialized = false;
        this.relationships.clear();
    }

    /**
     * Execute an intent
     */
    public async execute(intent: Intent, context: RequestContext): Promise<PluginResult> {
        if (!this.initialized) {
            return {
                success: false,
                error: 'Plugin not initialized'
            };
        }

        try {
            switch (intent.action) {
                case 'relationship:create':
                    return this.handleCreateRelationship(intent.data, context);
                case 'relationship:get':
                    return this.handleGetRelationship(intent.data, context);
                case 'relationship:update':
                    return this.handleUpdateRelationship(intent.data, context);
                case 'relationship:delete':
                    return this.handleDeleteRelationship(intent.data, context);
                default:
                    return {
                        success: false,
                        error: `Unsupported intent: ${intent.action}`
                    };
            }
        } catch (error) {
            this.logger.error(`Error executing intent ${intent.action}:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Handle creating a relationship
     */
    private async handleCreateRelationship(data: any, context: RequestContext): Promise<PluginResult> {
        const { source, target, type, metadata } = data || {};

        if (!source || !target || !type) {
            return {
                success: false,
                error: 'Source, target, and type are required for relationship creation'
            };
        }

        // Create relationship ID
        const relationshipId = `${source}-${type}-${target}`;

        // Check if relationship already exists
        if (this.relationships.has(relationshipId)) {
            return {
                success: false,
                error: 'Relationship already exists'
            };
        }

        // Create relationship object
        const relationship = {
            id: relationshipId,
            source,
            target,
            type,
            metadata: metadata || {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Store relationship
        this.relationships.set(relationshipId, relationship);

        return {
            success: true,
            data: {
                relationship,
                message: 'Relationship created successfully'
            }
        };
    }

    /**
     * Handle getting a relationship
     */
    private async handleGetRelationship(data: any, context: RequestContext): Promise<PluginResult> {
        const { id, source, target, type } = data || {};

        if (id) {
            // Get by ID
            const relationship = this.relationships.get(id);
            if (!relationship) {
                return {
                    success: false,
                    error: `Relationship with ID ${id} not found`
                };
            }

            return {
                success: true,
                data: {
                    relationship
                }
            };
        } else if (source && target && type) {
            // Get by triple
            const relationshipId = `${source}-${type}-${target}`;
            const relationship = this.relationships.get(relationshipId);

            if (!relationship) {
                return {
                    success: false,
                    error: `Relationship not found`
                };
            }

            return {
                success: true,
                data: {
                    relationship
                }
            };
        } else {
            return {
                success: false,
                error: 'Either ID or source, target, and type are required'
            };
        }
    }

    /**
     * Handle updating a relationship
     */
    private async handleUpdateRelationship(data: any, context: RequestContext): Promise<PluginResult> {
        const { id, metadata } = data || {};

        if (!id || !metadata) {
            return {
                success: false,
                error: 'ID and metadata are required for relationship update'
            };
        }

        // Get relationship
        const relationship = this.relationships.get(id);
        if (!relationship) {
            return {
                success: false,
                error: `Relationship with ID ${id} not found`
            };
        }

        // Update relationship
        relationship.metadata = { ...relationship.metadata, ...metadata };
        relationship.updatedAt = new Date().toISOString();

        // Store updated relationship
        this.relationships.set(id, relationship);

        return {
            success: true,
            data: {
                relationship,
                message: 'Relationship updated successfully'
            }
        };
    }

    /**
     * Handle deleting a relationship
     */
    private async handleDeleteRelationship(data: any, context: RequestContext): Promise<PluginResult> {
        const { id } = data || {};

        if (!id) {
            return {
                success: false,
                error: 'ID is required for relationship deletion'
            };
        }

        // Check if relationship exists
        if (!this.relationships.has(id)) {
            return {
                success: false,
                error: `Relationship with ID ${id} not found`
            };
        }

        // Delete relationship
        this.relationships.delete(id);

        return {
            success: true,
            data: {
                message: `Relationship ${id} deleted successfully`
            }
        };
    }
} 