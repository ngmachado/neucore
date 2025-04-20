# neucore

Modern AI framework for building context-aware AI applications.

> **Early Development Notice**: neucore is currently in early development (v0.0.1). APIs may change significantly between versions. See [Component Status](docs/COMPONENT-STATUS.md) for implementation details.

## Overview

neucore provides the essential building blocks for creating sophisticated AI applications with memory, context management, reasoning capabilities, and plugin-based extensibility. It's designed to be modular, flexible, and performant.

## Key Features

- **Memory Management**: Store and retrieve conversations, documents, and other data with vector embeddings for semantic search
- **Context Building**: Intelligently select relevant context for LLM prompts
- **Reasoning System**: Structured approaches to complex reasoning (Chain of Thought, etc.)
- **Template System**: Dynamic content generation with variable substitution and formatting
- **Action System**: Define and execute concrete operations with validation
- **Character Traits System**: Define and apply consistent AI personalities and styles
- **Model Context Protocol (MCP)**: Structured approach to AI interactions
- **Provider Adapters**: Support for multiple AI providers (currently Anthropic, with OpenAI planned)
- **RAG System**: Enhance responses with knowledge retrieval and processing
- **Goal Management**: Track and manage objectives for agents and users

## Installation

```bash
npm install neucore
```

## Quick Start

```typescript
import { 
  createProviderFactory,
  createContextBuilder,
  ChainOfThoughtReasoner,
  ReasoningMethod
} from 'neucore';

// Initialize provider
const providerFactory = createProviderFactory({
  anthropic: {
    apiKey: "your-api-key",
    defaultModel: "claude-3-sonnet-20240229"
  }
});
const modelProvider = providerFactory.getProvider();

// Create a reasoning system
const reasoner = new ChainOfThoughtReasoner(modelProvider, {
  method: ReasoningMethod.CHAIN_OF_THOUGHT
});

// Use reasoning to solve a complex problem
const result = await reasoner.reason("How can I optimize database queries to improve application performance?", {
  methodOptions: {
    stepCount: 5,
    enableTaskPlanning: true
  }
});

console.log(result.conclusion);
```

## Component Status

See [Component Status](docs/COMPONENT-STATUS.md) for the current implementation status of each component.

## Model Context Protocol (MCP)

The Model Context Protocol provides a structured intent-based system for AI interactions, inspired by mature application design patterns.

### Key Features

- **Intent System**: Route requests to appropriate handlers based on actions and categories
- **Provider Abstraction**: Decouple client code from specific AI provider implementations
- **Flexible Routing**: Support for targeted intents and broadcasts to multiple handlers
- **Extensible Design**: Add new handlers and actions without modifying client code

### Example Usage

```typescript
// Create an intent router
const router = new IntentRouter();

// Register handler(s)
await router.registerHandler(new AnthropicHandler(apiKey));

// Create and send an intent
const intent = new Intent('anthropic:generate', {
  prompt: 'Write a haiku about programming'
});
intent.putExtra('model', 'claude-3-haiku-20240307');

// Send the intent to get results
const results = await router.sendIntent(intent, {
  userId: 'user123'
});
```

## Documentation

- [Documentation Index](docs/README.md) - Complete list of all documentation
- [System Documentation](docs/SYSTEM-DOCUMENTATION.md) - Comprehensive overview of all major subsystems
- [Reasoning System](docs/REASONING.md) - Documentation for the reasoning system
- [Validation System](docs/VALIDATION.md) - Utilities for runtime type checking and validation
- [Future Reasoning Methods](docs/README-future-methods.md) - Planned reasoning implementations
- [Reasoner Implementation Guide](docs/IMPLEMENTATION-GUIDE.md) - Guide for implementing new reasoners
- [Mock Migration Guide](docs/MOCK-MIGRATION.md) - Guide for proper dependency injection

## Directory Structure

```
neucore/
├── docs/                     # Documentation files
│   ├── SYSTEM-DOCUMENTATION.md # System overview
│   ├── COMPONENT-STATUS.md   # Implementation status
│   ├── REASONING.md          # Reasoning system docs
│   ├── CHARACTER.md          # Character system docs
│   └── ...                   # Other documentation
├── src/
│   ├── core/                  # Core framework functionality
│   │   ├── memory/            # Memory management
│   │   ├── context/           # Context building
│   │   ├── reasoning/         # Reasoning system
│   │   ├── character/         # Character traits system 
│   │   ├── actions/           # Action system 
│   │   ├── templates/         # Template system
│   │   ├── rag/               # Retrieval Augmented Generation
│   │   ├── goals/             # Goal management
│   │   ├── providers/         # Model providers
│   │   ├── relationships/     # Entity relationships
│   │   ├── database/          # Database abstraction
│   │   ├── validation/        # Data validation
│   │   ├── logging/           # Logging system
│   │   ├── config/            # Configuration
│   │   └── errors/            # Error handling
│   ├── mcp/                   # Model Context Protocol
│   ├── test/                  # Testing utilities and mocks
│   ├── types/                 # Type definitions
│   └── index.ts               # Main exports
```

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run linter
npm run lint
```

## Roadmap

- Complete OpenAI provider implementation
- Implement additional reasoning methods (Tree of Thought, ReAct, etc.)
- Add comprehensive validation across all components
- Enhance error handling and reporting
- Add streaming support to all providers
- Implement database adapters for popular databases
- Create higher-level agent abstractions


## Research

[NeuroCore](https://publish.obsidian.md/axe/projects/NeuroCore)

## Contributing

As this project is in early development, please contact the maintainers before making significant contributions.

## License

MIT 
