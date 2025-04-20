# Document Manager Plugin

This plugin manages document operations including embedding, search, and deletion.

## Features

- Create embeddings for document content
- Search documents with semantic similarity
- Delete documents from the vector database

## Intents

| Intent | Description |
|--------|-------------|
| `document:embed` | Create embeddings for document content and store in database |
| `document:search` | Search for documents semantically similar to a query |
| `document:delete` | Delete documents from the vector database |

## Configuration

```json
{
  "dbPath": "./data/neurocore.db"
}
```

## Usage Example

```typescript
// Embed a document
const embedIntent = new Intent('document:embed', {
  content: "Climate change is a significant challenge facing humanity...",
  metadata: {
    title: "Climate Change Overview",
    source: "Research Paper",
    type: "document"
  }
});

await mcp.executeIntent(embedIntent);

// Search for documents
const searchIntent = new Intent('document:search', {
  query: "What are the effects of climate change?",
  limit: 5,
  minScore: 0.3
});

const searchResult = await mcp.executeIntent(searchIntent);
console.log(searchResult.data.results);
``` 