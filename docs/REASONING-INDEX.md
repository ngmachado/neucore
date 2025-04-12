# NeuroCore Reasoning System Documentation

Welcome to the NeuroCore Reasoning System documentation. This directory contains comprehensive documentation for understanding, using, and extending the reasoning capabilities of NeuroCore.

## Documentation Index

### Main Documentation
- [README.md](./README.md) - Main documentation for the reasoning system
- [IMPLEMENTATION-GUIDE.md](./IMPLEMENTATION-GUIDE.md) - Guide for implementing new reasoners
- [README-future-methods.md](./README-future-methods.md) - Documentation for planned reasoning methods

### Core Files
- [types.ts](./types.ts) - Type definitions for the reasoning system
- [reasoner.ts](./reasoner.ts) - Base reasoner interfaces and abstract class
- [chainOfThoughtReasoner.ts](./chainOfThoughtReasoner.ts) - Chain of Thought implementation

## Reasoning Methods Overview

NeuroCore supports (or plans to support) the following reasoning methods:

| Method | Status | Description | Documentation |
|--------|--------|-------------|---------------|
| Chain of Thought | Implemented | Step-by-step reasoning with explicit intermediate steps | [README.md](./README.md#chain-of-thought-reasoner) |
| Tree of Thought | Planned | Explores multiple reasoning paths in a tree structure | [README-future-methods.md](./README-future-methods.md#tree-of-thought-tot) |
| ReAct | Planned | Reasoning and Acting in alternating sequence | [README-future-methods.md](./README-future-methods.md#react-reasoning--acting) |
| Socratic | Planned | Query-based reasoning through questions | [README-future-methods.md](./README-future-methods.md#socratic-method) |
| First Principles | Planned | Breaking down problems to fundamental elements | [README-future-methods.md](./README-future-methods.md#first-principles-reasoning) |
| Reflexion | Planned | Self-critical reasoning with reflection | [README-future-methods.md](./README-future-methods.md#reflexion) |

## Quick Start

To use the reasoning system in your application:

```typescript
import { ChainOfThoughtReasoner } from 'neurocore/src/core/reasoning/chainOfThoughtReasoner';
import { ReasoningMethod } from 'neurocore/src/core/reasoning/types';
import { IModelProvider } from 'neurocore/src/core/providers/modelProvider';

// Initialize a model provider
const modelProvider: IModelProvider = /* your model provider */;

// Create a reasoner
const reasoner = new ChainOfThoughtReasoner(modelProvider, {
    method: ReasoningMethod.CHAIN_OF_THOUGHT
});

// Perform reasoning
const result = await reasoner.reason("How can I solve this problem?");

// Use the result
console.log(result.conclusion);
```

## Implementing a New Reasoner

If you want to implement a new reasoning method, see the [Implementation Guide](./IMPLEMENTATION-GUIDE.md) for detailed instructions.

## Integration with Other Systems

The reasoning system integrates with other NeuroCore components:

- **Goal Management** - For goal-oriented reasoning
- **Memory System** - For accessing and updating memory during reasoning
- **Context Building** - For incorporating context into reasoning
- **Action System** - For taking actions based on reasoning conclusions

## Contributing

To contribute to the reasoning system:

1. Follow the coding style and patterns in existing files
2. Document your code with JSDoc comments
3. Write tests for your implementation
4. Update documentation to reflect your changes
5. Submit a pull request with your changes

## Architecture

The reasoning system follows this architectural pattern:

```
IReasoner (interface)
    ↑
BaseReasoner (abstract class)
    ↑
ConcreteReasoners (implementations)
    - ChainOfThoughtReasoner
    - TreeOfThoughtReasoner (planned)
    - ReActReasoner (planned)
    - etc.
```

Each reasoner uses a model provider to generate text and implements a specific reasoning methodology. 