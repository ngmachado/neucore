# neucore Plugin Architecture

This document explains the plugin system architecture for the neucore framework.

> **Navigation**: [Back to README](../README.md) | [System Documentation](SYSTEM-DOCUMENTATION.md) | [Plugin Implementation Guide](PLUGIN-IMPLEMENTATION-GUIDE.md)

## Current Plugin System

The current plugin system consists of several components:

1. **Plugin Interface**: All plugins implement the `IPlugin` interface from `src/mcp/interfaces/plugin.ts`
2. **Master Control Program (MCP)**: Central coordinator that manages plugins and routes intents
3. **Core Plugins**: Set of built-in plugins providing essential functionality

### Plugin Interface

All plugins must implement the following interface:

```typescript
interface IPlugin {
  getId(): UUID;
  getName(): string;
  canHandle(intent: Intent): boolean;
  supportedIntents(): string[];
  execute(intent: Intent, context: RequestContext): Promise<PluginResult>;
  initialize?(): Promise<void>;
  shutdown?(): Promise<void>;
}
```

### Plugin Registration and Usage

In the current implementation, plugins are manually registered in `app.ts`:

```typescript
// Create and register plugin
const myPlugin = new MyPlugin(options);
mcp.registerPlugin(myPlugin);
await myPlugin.initialize();
```

### Intent Handling

Plugins declare which intents they can handle:

```typescript
public canHandle(intent: Intent): boolean {
  return intent.action.startsWith('myPlugin:');
}

public supportedIntents(): string[] {
  return [
    'myPlugin:doSomething',
    'myPlugin:doSomethingElse'
  ];
}
```

## Plugin System Evolution

The codebase shows evidence of transitioning to a more dynamic plugin system:

### 1. Standalone Plugin Files

Traditional plugin implementations:
- `src/plugins/reasoningPlugin.ts`
- `src/plugins/contextPlugin.ts`
- etc.

These are loaded and initialized directly in `app.ts`.

### 2. Plugin System Adapters

The `src/plugins/system/` directory contains adapter implementations for core plugins:
- `document-manager/`
- `context/`
- `direct-chat/`

These adapters wrap the standalone plugin implementations to make them compatible with the discovery system.

Example adapter:
```typescript
export default class DiscoveryDocumentManagerPlugin implements IPlugin {
  private plugin: DocumentManagerPlugin;

  constructor(options: { logger: any, config: any }) {
    this.plugin = new DocumentManagerPlugin(options.config);
  }

  // Delegate to the underlying plugin
  async execute(intent: Intent, context: RequestContext): Promise<PluginResult> {
    return this.plugin.execute(intent, context);
  }
  // ...other methods
}
```

### 3. Plugin Discovery System

The `src/plugins/discovery/` directory implements a dynamic plugin loading system:
- `loader.ts` - Loads plugins from filesystem
- `manifest.ts` - Defines plugin metadata format
- `pluginManager.ts` - Manages plugin lifecycle
- `priorityResolver.ts` - Resolves intent handling priorities
- `integration.ts` - Integrates with the MCP

### 4. Plugin Template

The `src/plugins/template/` directory provides a template for creating new plugins:
- `manifest.json` - Example plugin manifest
- `README.md` - Instructions for plugin development
- `src/` - Source code template

## Recommended Plugin Development Path

Based on the current architecture and evolution, here's the recommended approach for plugin development:

### For Core Plugins:

1. Implement the plugin as a standalone class in `src/plugins/`
2. Register and initialize in `app.ts`
3. Export the plugin in `src/plugins/index.ts`

### For Dynamic Plugins:

1. Create a new directory using the template in `src/plugins/template/`
2. Implement the plugin interface in `src/index.ts`
3. Create a manifest file with metadata
4. Document the plugin in the `docs/` directory

## Plugin Configuration

Plugins are configured through configuration files:
- `src/plugins/plugin-config.json` - Main plugin configuration
- Plugin-specific config files (e.g., `directChat-config.json`)

The configuration structure:
```json
{
  "exposedIntents": ["list", "of", "intents"],
  "config": {
    "shared": "settings"
  },
  "plugins": {
    "plugin-name": {
      "enabled": true,
      "setting1": "value1"
    }
  }
}
```

## Future Improvements

To complete the transition to a fully dynamic plugin system:

1. Standardize plugin initialization and configuration
2. Move all plugins to the discovery-based system
3. Create a central plugin registry
4. Implement hot-reloading for development
5. Add versioning and dependency management 