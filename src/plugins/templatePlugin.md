# Template Plugin

The `TemplatePlugin` is a Neurocore plugin that provides template rendering capabilities through the MCP intent system. It serves as the integration point between the core template system and other plugins.

## Supported Intents

The plugin supports the following intents:

- `template:render` - Render a template with variables
- `template:register` - Register templates in the registry
- `template:get` - Retrieve templates from the registry
- `template:provider:register` - Register data providers

## Intent Details

### template:render

Renders a template with the provided variables.

**Input**:
```typescript
{
  // Either templateId or template is required
  templateId?: string;  // ID of a registered template
  template?: string;    // Template content string
  variables?: Record<string, any>; // Variables to use in rendering
}
```

**Output**:
```typescript
{
  success: true,
  data: {
    rendered: string;  // The rendered template
    templateId?: string; // The template ID if a registered template was used
  }
}
```

### template:register

Registers one or more templates in the registry.

**Input**:
```typescript
{
  // Either template or templates is required
  template?: Template;     // Single template to register
  templates?: Template[];  // Multiple templates to register
}
```

**Output**:
```typescript
{
  success: true,
  data: {
    id?: string;       // ID of the registered template (if single)
    ids?: string[];    // IDs of the registered templates (if multiple)
    count?: number;    // Number of templates registered
    message: string;   // Success message
  }
}
```

### template:get

Retrieves templates from the registry.

**Input**:
```typescript
{
  // Either id or options is required
  id?: string;                       // Get a template by ID
  options?: TemplateSelectionOptions; // Find templates by criteria
}
```

**Output**:
```typescript
{
  success: true,
  data: {
    template?: Template;     // The requested template (if by ID)
    templates?: Template[];  // The matching templates (if by options)
    count?: number;          // Number of templates found
  }
}
```

### template:provider:register

Registers a data provider with the template system.

**Input**:
```typescript
{
  provider: ITemplateDataProvider; // Data provider to register
}
```

**Output**:
```typescript
{
  success: true,
  data: {
    namespace: string;  // The registered namespace
    message: string;    // Success message
  }
}
```

## Built-in Templates

The plugin registers the following built-in templates:

- `system:response:standard` - Standard response template
- `system:response:greeting` - Greeting response template
- `system:response:formatted` - Formatted response template

## Usage Examples

### Rendering a Template

```typescript
const renderIntent = new Intent('template:render', {
  template: 'Hello {{message.username}}!',
  variables: {
    message: {
      username: 'John'
    }
  }
});

const result = await mcp.executeIntent(renderIntent);
console.log(result.data.rendered); // "Hello John!"
```

### Registering a Template

```typescript
const registerIntent = new Intent('template:register', {
  template: {
    id: 'custom:greeting',
    category: 'greeting',
    content: 'Welcome, {{message.username}}!',
    metadata: {
      usage: 'welcome',
      priority: 10,
      pluginId: 'custom-plugin'
    }
  }
});

await mcp.executeIntent(registerIntent);
```

### Finding Templates

```typescript
const getIntent = new Intent('template:get', {
  options: {
    category: 'greeting',
    pluginId: 'custom-plugin'
  }
});

const result = await mcp.executeIntent(getIntent);
const templates = result.data.templates;
```

### Registering a Data Provider

```typescript
class UserProvider implements ITemplateDataProvider {
  getNamespace() { return 'user'; }
  getVariables(ctx) { return { name: 'John' }; }
}

const providerIntent = new Intent('template:provider:register', {
  provider: new UserProvider()
});

await mcp.executeIntent(providerIntent);
```

## Integration with Other Plugins

Plugins can use the `TemplatePlugin` to:

1. Register custom templates for their domain
2. Register data providers for plugin-specific variables
3. Render templates with dynamic content

The recommended pattern is to:

1. Check if the plugin is available through the MCP
2. Register your templates and providers during initialization
3. Use the template rendering for dynamic content generation

## Error Handling

The plugin returns detailed error messages when:

- Required parameters are missing
- Templates or providers cannot be found
- Rendering fails due to missing variables

Always check the `success` flag in the result and handle errors accordingly. 