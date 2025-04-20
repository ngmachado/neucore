# Direct Chat Plugin

This plugin provides direct chat interaction capabilities without requiring external services.

## Features

- Send and receive chat messages
- Optional reasoning for complex queries
- Context-aware responses
- Configuration for different character personas

## Intents

| Intent | Description |
|--------|-------------|
| `directChat:message` | Send a message and get a response |

## Configuration

```json
{
  "characterId": null,
  "defaultCharacterName": "Assistant",
  "useReasoning": true,
  "context": {
    "maxItems": 3
  },
  "reasoning": {
    "model": "gpt-4o",
    "temperature": 0.7,
    "maxTokens": 500
  }
}
```

## Usage Example

```typescript
const intent = new Intent('directChat:message', {
  message: 'Hello, how are you?',
  sessionId: 'user-123'
});

const result = await mcp.executeIntent(intent);
console.log(result.data.message);
``` 