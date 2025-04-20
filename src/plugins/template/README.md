# My Plugin

Brief description of what your plugin does.

## Features

- Feature 1
- Feature 2
- Feature 3

## Intents

| Intent | Description |
|--------|-------------|
| `my-plugin:action` | Description of what this intent does |

## Configuration

```json
{
  "setting1": "value1",
  "setting2": "value2"
}
```

## Usage Example

```typescript
const intent = new Intent('my-plugin:action', {
  // Intent data
  param1: 'value1',
  param2: 'value2'
});

const result = await mcp.executeIntent(intent);
console.log(result.data);
```

## Development

1. Modify `src/index.ts` to implement your plugin logic
2. Update the manifest.json with your plugin details
3. Update this README.md with relevant information
4. Test your plugin with the framework 