# Plugin Discovery System

The Plugin Discovery System provides a way to automatically discover, load, and manage plugins using manifest files, with priority-based intent resolution.

## Features

- Automatic plugin discovery from manifest files
- Priority-based intent resolution
- Plugin substitution capability
- Separation of system and user plugins

## Directory Structure

```
plugins/
  ├── system/              # Built-in system plugins
  │   ├── direct-chat/     # Direct chat plugin
  │   │   ├── manifest.json
  │   │   ├── index.ts     # Entry point that re-exports the implementation
  │   │   ├── README.md    # Plugin documentation
  │   │   └── src/         # Source code folder
  │   │       └── index.ts # Actual implementation
  │   ├── context/
  │   │   └── ...
  │   └── ...
  │
  ├── custom/              # User-defined plugins (same structure as system)
  │   ├── my-plugin/
  │   │   └── ...
  │   └── ...
  │
  └── template/            # Plugin template to copy for new plugins
      ├── manifest.json
      ├── index.ts
      ├── README.md
      └── src/
          └── index.ts
```

## Plugin Structure

Each plugin should follow this folder structure:

- `manifest.json` - Plugin metadata and configuration
- `index.ts` - Entry point that exports the plugin class
- `README.md` - Documentation for the plugin
- `src/` - Source code folder
  - `index.ts` - Main implementation file
  - Other source files as needed

## Plugin Manifest

Each plugin is defined by a `manifest.json` file:

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "entryPoint": "index.ts",
  "enabled": true,
  "intentMapping": {
    "my-plugin:doSomething": {
      "priority": 10,
      "enabled": true
    }
  },
  "config": {
    "customSetting": "value"
  }
}
```

## Creating a New Plugin

The easiest way to create a new plugin is to copy the template folder:

```bash
# Copy the template
cp -r src/plugins/template src/plugins/custom/my-new-plugin

# Customize the files
vim src/plugins/custom/my-new-plugin/manifest.json
vim src/plugins/custom/my-new-plugin/src/index.ts
vim src/plugins/custom/my-new-plugin/README.md
```

## System Initialization

```typescript
import { initializeWithDiscovery } from './plugins/discovery/mcp-integration';
import { PluginDiscoveryConfig } from './plugins/discovery/config';
import * as path from 'path';

async function startApplication() {
  // Configure discovery
  const discoveryConfig: PluginDiscoveryConfig = {
    enabled: true,
    systemDirectory: path.join(__dirname, 'plugins', 'system'),
    userDirectory: path.join(__dirname, 'plugins', 'custom'),
    usePriorityResolver: true,
    loadSystemPlugins: true,
    loadUserPlugins: true,
    debug: true
  };
  
  // Initialize MCP with discovery
  const mcp = await initializeWithDiscovery(discoveryConfig);
  
  // Use MCP as usual
  await mcp.executeIntent(/* ... */);
}
```

## Priority-Based Intent Resolution

When multiple plugins handle the same intent, the system uses:

1. User-defined overrides (if specified)
2. Plugin priority (higher values take precedence)
3. Original order (if equal priority)

## Plugin Substitution

You can completely replace system plugins by specifying which ones to substitute:

```json
{
  "substitutes": ["direct-chat"]
}
``` 