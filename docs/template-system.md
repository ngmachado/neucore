# Template System

The Neurocore framework includes a powerful template system for dynamic content generation with variable substitution. This system allows plugins to create, manage, and render templates with placeholders that are replaced with context-specific values at runtime.

## Core Components

The template system consists of several core components:

### TemplateRegistry

The `TemplateRegistry` manages the storage and retrieval of templates:

- Register individual templates or collections of templates
- Find templates based on category, usage, tags, or custom criteria
- Select the best matching template based on priority

### TemplateDataRegistry & Providers

The data provider system manages variable values for template rendering:

- `ITemplateDataProvider` interface for implementing custom data providers
- Namespace-based variable organization (e.g., `message.username`, `bot.name`)
- Priority-based provider resolution

### TemplateEngine

The `TemplateEngine` handles the parsing and rendering of templates:

- Replace placeholders in template content with actual values
- Support for dot notation path resolution (e.g., `{{message.sender.username}}`)
- Error handling for missing values

## Using Templates

### Basic Template Usage

Templates can be registered and retrieved using the `TemplatePlugin` through intents:

```typescript
// Register a template
const registerIntent = new Intent('template:register', {
  template: {
    id: 'my-template',
    category: 'response',
    content: 'Hello {{message.username}}!',
    metadata: {
      usage: 'greeting',
      priority: 100,
      pluginId: 'my-plugin'
    }
  }
});

// Execute the intent
const registerResult = await mcp.executeIntent(registerIntent);

// Render a template
const renderIntent = new Intent('template:render', {
  templateId: 'my-template',
  variables: {
    message: {
      username: 'John'
    }
  }
});

const renderResult = await mcp.executeIntent(renderIntent);
console.log(renderResult.data.rendered); // Outputs: "Hello John!"
```

### Template Selection

Templates can be selected based on various criteria:

```typescript
const getIntent = new Intent('template:get', {
  options: {
    category: 'response',
    usage: 'greeting',
    tags: ['formal'],
    pluginId: 'my-plugin'
  }
});

const getResult = await mcp.executeIntent(getIntent);
const templates = getResult.data.templates;
```

## Creating Data Providers

Custom data providers can be created by implementing the `ITemplateDataProvider` interface:

```typescript
import { ITemplateDataProvider } from '../../core/templates/dataProvider';

export class UserDataProvider implements ITemplateDataProvider {
  public getNamespace(): string {
    return 'user';
  }
  
  public getPriority(): number {
    return 100; 
  }
  
  public getVariables(context: any): Record<string, any> {
    // Extract user data from context
    const user = context.user || {};
    
    return {
      id: user.id || '',
      name: user.name || '',
      email: user.email || '',
      // Additional user properties
    };
  }
}
```

### Registering Data Providers

Data providers must be registered with the template system:

```typescript
const providerIntent = new Intent('template:provider:register', {
  provider: new UserDataProvider()
});

await mcp.executeIntent(providerIntent);
```

## Plugin Integration

### Example: Alfafrens Plugin Integration

The Alfafrens plugin demonstrates a complete integration with the template system:

1. **TemplateIntegration Class**: Manages template and provider registration
2. **MessageDataProvider**: Provides message-specific variables
3. **BotDataProvider**: Provides bot-specific variables
4. **ResponseFormatter**: Formats responses for better readability
5. **ALFAFRENS_TEMPLATES**: Default templates for various response types

Integration can be initialized during plugin startup:

```typescript
// In plugin's initialize method
this.templateIntegration = new TemplateIntegration({
  mcp: this.mcp,
  logger: this.logger,
  botConfig: this.config
});

await this.templateIntegration.initialize();
```

### Response Formatting

The Alfafrens plugin includes a `ResponseFormatter` that improves readability:

- Removes artificial signatures
- Breaks long paragraphs into smaller ones
- Formats lists and structured content
- Applies appropriate spacing based on response length

## Available Variables

The template system includes several built-in variable namespaces:

### Message Variables

| Variable | Description |
|----------|-------------|
| `{{message.id}}` | Unique message ID |
| `{{message.content}}` | Message content |
| `{{message.username}}` | Username of sender |
| `{{message.time}}` | Formatted message time |
| `{{message.date}}` | Formatted message date |

### Bot Variables

| Variable | Description |
|----------|-------------|
| `{{bot.name}}` | Bot name |
| `{{bot.username}}` | Bot username |
| `{{bot.personality}}` | Bot personality trait |

### System Variables

| Variable | Description |
|----------|-------------|
| `{{system.date}}` | Current date |
| `{{system.time}}` | Current time |
| `{{system.timestamp}}` | ISO timestamp |

## Templates Directory

The template system stores templates in memory, organized by:

- Category
- Usage
- Plugin ID
- Tags

This organization allows for efficient template selection based on the specific context of the response.

## Best Practices

1. Use descriptive template IDs that include plugin name and purpose
2. Organize templates by category and usage for easy selection
3. Use priorities to ensure the most appropriate template is selected
4. Create custom data providers for plugin-specific variables
5. Format responses for readability before applying templates 