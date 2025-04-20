# Core Template System

This directory contains the implementation of the Neurocore template system, which provides dynamic content generation with variable substitution.

## Overview

The template system allows plugins to:
- Define and register templates with placeholders
- Register data providers for variable values
- Render templates with context-specific data

## Files

- `index.ts` - Main entry point exporting all template components
- `dataProvider.ts` - Interfaces for data providers that supply variable values
- `templateRegistry.ts` - Registry for storing and retrieving templates
- `templateEngine.ts` - Engine for parsing and rendering templates

## Quick Start

```typescript
import { createTemplateSystem } from './index';

// Create the template system
const system = createTemplateSystem(logger);
const { templateRegistry, dataRegistry, templateEngine } = system;

// Register a template
templateRegistry.registerTemplate({
  id: 'greeting',
  category: 'response',
  content: 'Hello {{user.name}}!',
  metadata: {
    usage: 'greeting'
  }
});

// Register a data provider
class UserDataProvider {
  getNamespace() { return 'user'; }
  getVariables() { return { name: 'John' }; }
}
dataRegistry.registerProvider(new UserDataProvider());

// Render a template
const result = templateEngine.render('greeting', { 
  requestContext: {} 
});
// result = "Hello John!"
```

## Architecture

### Template Registry

The `TemplateRegistry` is responsible for:
- Storing templates in-memory
- Providing template lookup by ID, category, tags, etc.
- Managing template priorities for selection

### Data Providers

Data providers implement the `ITemplateDataProvider` interface:
- `getNamespace()` - Returns the namespace for variables
- `getVariables(context)` - Extracts variables from context
- `getPriority()` - Defines provider precedence

### Template Engine

The `TemplateEngine` handles template rendering:
- Parses template strings to find placeholders
- Resolves variable values from registered providers
- Replaces placeholders with actual values

## Best Practices

1. Use descriptive namespaces for data providers
2. Keep templates simple and focused
3. Avoid deep nesting of variables
4. Set appropriate priorities for templates and providers
5. Handle missing values gracefully

## Creating a New Template Provider

```typescript
import { ITemplateDataProvider } from './dataProvider';

export class CustomDataProvider implements ITemplateDataProvider {
  public getNamespace(): string {
    return 'custom';
  }
  
  public getPriority(): number {
    return 50; // Medium priority
  }
  
  public getVariables(context: any): Record<string, any> {
    return {
      value1: 'example',
      value2: context.someData || 'default'
    };
  }
}
```

## Integration with Plugins

The core template system is designed to be used by plugins through the `TemplatePlugin`. See the plugin documentation for details on integration. 