# Mock Migration Guide

This guide helps you migrate from inline fallbacks and mocks to using proper testing mocks.

> **Navigation**: [Back to README](../README.md) | [System Documentation](SYSTEM-DOCUMENTATION.md) | [Validation System](VALIDATION.md)

## The Problem

The codebase currently contains numerous instances of inline fallbacks and mocks:

```typescript
// Example of problematic code with inline fallback
class SomeService {
  constructor(provider) {
    // Inline fallback
    this.provider = provider || {
      doSomething: () => "fallback response",
      process: () => ({ result: "mock result" })
    };
  }
}
```

These patterns:
1. Make testing difficult
2. Hide dependencies
3. Make it unclear what's a mock vs. production code
4. May introduce security or performance issues

## The Solution

### 1. Use Dependency Injection

```typescript
// Better approach
class SomeService {
  constructor(provider) {
    if (!provider) {
      throw new Error("Provider is required");
    }
    this.provider = provider;
  }
}
```

### 2. Use Proper Test Mocks

```typescript
// In your tests
import { MockModelProvider } from '../test/mocks';

const mockProvider = new MockModelProvider(['Response 1', 'Response 2']);
const service = new SomeService(mockProvider);
```

### 3. For Development Convenience, Use Factory Functions

```typescript
// Factory function with clear fallback for development
export function createSomeService(options = {}) {
  const {
    provider = process.env.NODE_ENV === 'development' 
      ? new MockModelProvider() 
      : undefined
  } = options;
  
  if (!provider) {
    throw new Error("Provider is required");
  }
  
  return new SomeService(provider);
}
```

## Migration Steps

1. **Identify inline mocks/fallbacks**:
   ```bash
   grep -r "= [^=]*|| {" --include="*.ts" ./src
   ```

2. **Replace with proper DI**:
   - Make dependencies required in constructors
   - Throw meaningful errors if dependencies are missing
   - Add JSDoc showing required dependencies

3. **Create proper mock implementations**:
   - Add to `src/test/mocks/` directory
   - Implement the same interface as the real dependency
   - Add helper methods for test control

4. **Update tests**:
   - Replace inline mocks with imports from test/mocks
   - Use explicit test fixtures

5. **Create factory functions** (optional):
   - For convenience during development
   - With clear environment checks
   - With explicit mock usage

## Example Migration

### Before:

```typescript
export class MemoryManager {
  constructor(database, embeddingProvider) {
    this.database = database || { 
      query: async () => [], 
      insert: async () => {} 
    };
    this.embeddingProvider = embeddingProvider || {
      generateEmbeddings: async () => [[0.1, 0.2, 0.3]]
    };
  }
}
```

### After:

```typescript
export class MemoryManager {
  constructor(database, embeddingProvider) {
    if (!database) throw new Error("Database is required");
    if (!embeddingProvider) throw new Error("Embedding provider is required");
    
    this.database = database;
    this.embeddingProvider = embeddingProvider;
  }
}

// In factory.ts
import { MockDatabase } from '../test/mocks';
import { MockEmbeddingProvider } from '../test/mocks';

export function createMemoryManager(options = {}) {
  const { 
    database = process.env.NODE_ENV === 'development' ? new MockDatabase() : undefined,
    embeddingProvider = process.env.NODE_ENV === 'development' ? new MockEmbeddingProvider() : undefined
  } = options;
  
  return new MemoryManager(database, embeddingProvider);
}
```

## Progress Tracking

Use this template to track migration progress:

| Component | Status | Notes |
|-----------|--------|-------|
| MemoryManager | 🚧 | Constructor fallbacks identified |
| ActionManager | 📝 | Not started |
| ContextBuilder | 📝 | Not started |
| etc. | | | 