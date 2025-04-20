# neucore Template System

> **Navigation**: [Back to README](../README.md) | [System Documentation](SYSTEM-DOCUMENTATION.md)

The neucore framework includes a powerful template system for dynamic content generation with variable substitution. This system allows plugins to create, manage, and render templates with placeholders that are replaced with context-specific values at runtime.

## Key Features

- **Variable Substitution**: Replace placeholders with dynamic values
- **Template Management**: Store and retrieve templates by category, usage, and tags
- **Conditional Rendering**: Include or exclude content based on conditions
- **Custom Data Providers**: Add custom variable namespaces
- **Response Formatting**: Improve readability of generated content

## Template Engine

The `TemplateEngine` class is responsible for:
1. Managing template storage
2. Registering data providers
3. Rendering templates with variables

### Basic Usage

```typescript
import { TemplateEngine } from 'neucore';

// Create a template engine
const templateEngine = new TemplateEngine();

// Register a template
templateEngine.registerTemplate({
  id: 'greeting',
  content: 'Hello, {{user.name}}! Welcome to {{system.appName}}.',
  category: 'messages',
  usage: 'welcome',
  priority: 10
});

// Render the template
const rendered = await templateEngine.renderTemplate('greeting', {
  user: { name: 'Alice' },
  system: { appName: 'My App' }
});

// Output: "Hello, Alice! Welcome to My App."
```

### Data Providers

Data providers supply variables for template rendering:

```typescript
templateEngine.registerDataProvider('user', async (context) => {
  return {
    name: context.userData.name,
    role: context.userData.role,
    lastLogin: formatDate(context.userData.lastLogin)
  };
});
```

### Conditional Templates

Templates can include conditional logic:

```typescript
const conditionalTemplate = `
{{#if user.isAdmin}}
  Welcome, Admin! You have {{admin.pendingTasks}} tasks.
{{else}}
  Welcome, {{user.name}}!
{{/if}}
`;
```

### Response Formatting

The framework includes a `ResponseFormatter` that improves readability:

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