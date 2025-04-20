# neucore Relationship Plugin

> **Navigation**: [Back to README](../README.md) | [Plugin Documentation](PLUGIN-IMPLEMENTATION-GUIDE.md)

The Relationship Plugin provides a way to model and manage relationships between entities in neucore.

> **Note**: This plugin is currently considered development-only and is not initialized in the default app setup. It uses an in-memory storage implementation that does not persist relationships between restarts.

## Supported Intents

The plugin supports the following intents:

- `relationship:create` - Create a new relationship between entities
- `relationship:get` - Retrieve existing relationships
- `relationship:update` - Update relationship metadata
- `relationship:delete` - Delete a relationship

## Intent Details

### relationship:create

Creates a new relationship between two entities.

**Input**:
```typescript
{
  source: string;    // Source entity ID
  target: string;    // Target entity ID 
  type: string;      // Relationship type (e.g., "knows", "parent_of")
  metadata?: object; // Optional metadata about the relationship
}
```

**Output**:
```typescript
{
  success: true,
  data: {
    relationship: {
      id: string;         // Generated relationship ID
      source: string;     // Source entity ID
      target: string;     // Target entity ID
      type: string;       // Relationship type
      metadata: object;   // Relationship metadata
      createdAt: string;  // Creation timestamp
      updatedAt: string;  // Last update timestamp
    },
    message: string;      // Success message
  }
}
```

### relationship:get

Retrieves a relationship by ID or by source-type-target triple.

**Input**:
```typescript
{
  // Either id or (source + target + type) is required
  id?: string;      // Relationship ID
  source?: string;  // Source entity ID
  target?: string;  // Target entity ID
  type?: string;    // Relationship type
}
```

**Output**:
```typescript
{
  success: true,
  data: {
    relationship: {
      id: string;         // Relationship ID
      source: string;     // Source entity ID
      target: string;     // Target entity ID
      type: string;       // Relationship type
      metadata: object;   // Relationship metadata
      createdAt: string;  // Creation timestamp
      updatedAt: string;  // Last update timestamp
    }
  }
}
```

### relationship:update

Updates an existing relationship's metadata.

**Input**:
```typescript
{
  id: string;        // Relationship ID
  metadata: object;  // New metadata to update or merge
  merge?: boolean;   // Whether to merge with existing metadata (default: false)
}
```

**Output**:
```typescript
{
  success: true,
  data: {
    relationship: {
      id: string;         // Relationship ID
      source: string;     // Source entity ID
      target: string;     // Target entity ID
      type: string;       // Relationship type
      metadata: object;   // Updated relationship metadata
      createdAt: string;  // Creation timestamp
      updatedAt: string;  // Updated timestamp
    },
    message: string;      // Success message
  }
}
```

### relationship:delete

Deletes an existing relationship.

**Input**:
```typescript
{
  id: string;  // Relationship ID to delete
}
```

**Output**:
```typescript
{
  success: true,
  data: {
    message: string;  // Success message
  }
}
```

## Implementation Details

The current implementation stores relationships in memory only and does not persist them between restarts. In a production environment, you would want to:

1. Initialize this plugin in app.ts
2. Connect it to a proper database backend
3. Use the database interfaces in `src/core/database/interfaces.ts`

## Integration with Other Plugins

The relationship plugin can be used by other plugins to:

1. Create relationships between users and content
2. Track relationships between entities in knowledge graphs
3. Establish connections for recommendation systems

## Future Development

To make this plugin production-ready:

1. Implement persistent storage using the database adapter
2. Add query capabilities for filtering and searching relationships
3. Implement relationship constraints and validation
4. Add support for bidirectional relationships 