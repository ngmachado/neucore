# Context Plugin

This plugin handles context-related operations for enhanced conversation awareness.

## Features

- Build context from various sources
- Retrieve context for a given query
- Process context to create meaningful responses

## Intents

| Intent | Description |
|--------|-------------|
| `context:build` | Build context from various sources for a given query |
| `context:retrieve` | Retrieve context items from storage |
| `context:process` | Process context items to create a meaningful response |

## Configuration

This plugin accepts minimal configuration as it relies on the document manager plugin for storage and retrieval operations.

## Usage Example

```typescript
// Build context for a query
const buildIntent = new Intent('context:build', {
  query: 'Tell me about climate change',
  options: {
    maxItems: 5,
    includeTypes: ['document', 'memory'],
    minScore: 0.3
  }
});

const contextResult = await mcp.executeIntent(buildIntent);

// Process the context
const processIntent = new Intent('context:process', {
  query: 'Tell me about climate change',
  context: contextResult.data.contextItems
});

const result = await mcp.executeIntent(processIntent);
``` 