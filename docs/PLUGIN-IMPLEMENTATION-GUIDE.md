# neucore Plugin Implementation Guide

This guide provides detailed instructions for creating plugins for the neucore framework.

> **Navigation**: [Back to README](../README.md) | [System Documentation](SYSTEM-DOCUMENTATION.md) | [Plugin Architecture](PLUGIN-ARCHITECTURE.md)

## Plugin Implementation Standards

### Basic Structure

All plugins should follow this basic structure:

```typescript
/**
 * [PluginName] - Brief description
 */
import { IPlugin, PluginResult, RequestContext } from '../mcp/interfaces/plugin';
import { Intent } from '../mcp/intent';
import { UUID, LogLevel } from '../types';

/**
 * [PluginName] implementation that handles [description of what it does]
 */
export class MyPlugin implements IPlugin {
    private initialized: boolean = false;
    private logger: any;
    
    // Add additional private fields here
    
    /**
     * Create a new [PluginName]
     * @param options Plugin configuration options
     */
    constructor(options: {
        logger: any;
        // Add additional required options here
    }) {
        this.logger = options.logger;
        // Initialize other options
    }
    
    /**
     * Get the unique ID of this plugin
     */
    public getId(): UUID {
        return 'my-plugin-id';
    }
    
    /**
     * Get the human-readable name of this plugin
     */
    public getName(): string {
        return 'My Plugin';
    }
    
    /**
     * Check if this plugin can handle the given intent
     * @param intent Intent to check
     */
    public canHandle(intent: Intent): boolean {
        return intent.action.startsWith('myPlugin:');
    }
    
    /**
     * Get the list of intents this plugin supports
     */
    public supportedIntents(): string[] {
        return [
            'myPlugin:action1',
            'myPlugin:action2'
        ];
    }
    
    /**
     * Initialize the plugin
     */
    public async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }
        
        this.logger.info('Initializing MyPlugin');
        // Perform initialization logic
        
        this.initialized = true;
    }
    
    /**
     * Execute an intent
     * @param intent Intent to execute
     * @param context Request context
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
                case 'myPlugin:action1':
                    return this.handleAction1(intent.data, context);
                case 'myPlugin:action2':
                    return this.handleAction2(intent.data, context);
                default:
                    return {
                        success: false,
                        error: `Unsupported intent: ${intent.action}`
                    };
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(`Error executing intent ${intent.action}: ${errorMessage}`);
            return {
                success: false,
                error: errorMessage
            };
        }
    }
    
    /**
     * Shutdown the plugin
     */
    public async shutdown(): Promise<void> {
        this.logger.info('Shutting down MyPlugin');
        // Perform cleanup logic
        this.initialized = false;
    }
    
    /**
     * Handle action1 intent
     * @private
     */
    private async handleAction1(data: any, context: RequestContext): Promise<PluginResult> {
        this.logger.debug('Handling action1', { data });
        
        // Validate required parameters
        const { requiredParam } = data || {};
        if (!requiredParam) {
            return {
                success: false,
                error: 'Required parameter missing'
            };
        }
        
        // Implementation logic
        
        return {
            success: true,
            data: {
                result: 'Action1 completed successfully'
            }
        };
    }
    
    /**
     * Handle action2 intent
     * @private
     */
    private async handleAction2(data: any, context: RequestContext): Promise<PluginResult> {
        // Implementation
    }
}
```

### Standard Constructor Options

Plugins should standardize on these constructor parameters:

```typescript
constructor(options: {
    logger: any;           // Required: Logger instance
    config?: any;          // Optional: Plugin configuration
    mcp?: MCP;             // Optional: MCP instance (if needed)
    providerFactory?: any; // Optional: Provider factory (if needed)
}) {
    this.logger = options.logger;
    this.config = options.config || {};
    this.mcp = options.mcp;
    this.providerFactory = options.providerFactory;
}
```

### Logging Standards

Use the standardized logger with appropriate log levels:

```typescript
// Debug: Detailed information for debugging
this.logger.debug('Detailed operation information', { 
    contextData: value 
});

// Info: Notable events but not problems
this.logger.info('Plugin initialized successfully');

// Warn: Potential issues that don't prevent operation
this.logger.warn('Configuration incomplete, using defaults');

// Error: Errors that prevent a specific operation
this.logger.error(`Failed to process intent: ${errorMessage}`);
```

### Error Handling

Follow these standards for error handling:

1. **Catch exceptions** in all intent handlers
2. **Format error messages** consistently
3. **Log errors** before returning error responses
4. **Include relevant context** in error messages

Example:

```typescript
try {
    // Operation that might fail
} catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.logger.error(`Failed to process intent: ${errorMessage}`, { 
        intentAction: intent.action,
        errorDetails: error 
    });
    return {
        success: false,
        error: `Operation failed: ${errorMessage}`
    };
}
```

### Plugin Results

Use consistent result formats:

```typescript
// Success result with data
return {
    success: true,
    data: {
        result: value,
        message: 'Operation completed successfully'
    }
};

// Error result
return {
    success: false,
    error: 'Specific error message'
};
```

## Plugin Documentation

Each plugin should have documentation that covers:

1. **Purpose**: What the plugin does
2. **Intents**: All supported intents with parameters and return values
3. **Configuration**: Required and optional configuration
4. **Examples**: Usage examples for each intent
5. **Integration**: How to use with other plugins

## Intent Naming Conventions

Follow these conventions for intent names:

- Use the pattern `pluginName:action`
- Use camelCase for the action part
- Use descriptive names that indicate what the action does

Examples:
- `character:load`
- `reasoning:analyze`
- `document:search`
- `template:render`

## Plugin Registration

Register plugins in `app.ts` using this pattern:

```typescript
// Create and register the plugin
const myPlugin = new MyPlugin({
    logger,
    config: {
        // Plugin-specific configuration
    }
});
mcp.registerPlugin(myPlugin);
await myPlugin.initialize();
logger.info('MyPlugin registered and initialized');
```

## Testing Plugins

Create tests that verify:

1. Intent handling
2. Error conditions
3. Proper initialization/shutdown
4. Integration with other plugins

```typescript
describe('MyPlugin', () => {
    let plugin: MyPlugin;
    let mockLogger: any;
    
    beforeEach(() => {
        mockLogger = { 
            debug: vi.fn(), 
            info: vi.fn(), 
            warn: vi.fn(), 
            error: vi.fn() 
        };
        
        plugin = new MyPlugin({ logger: mockLogger });
        await plugin.initialize();
    });
    
    afterEach(async () => {
        await plugin.shutdown();
    });
    
    it('should handle valid intents', async () => {
        // Test implementation
    });
    
    it('should reject invalid intents', async () => {
        // Test implementation
    });
});
``` 