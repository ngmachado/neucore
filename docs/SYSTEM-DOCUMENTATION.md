# neucore Framework Documentation

neucore is a modern AI framework for building context-aware AI applications. This document provides an overview of all major subsystems and how they interact to create sophisticated AI experiences.

> **Navigation**: [Back to README](../README.md) | [Component Status](COMPONENT-STATUS.md) | [Reasoning Documentation](REASONING.md)

## System Architecture

neucore is organized into several key subsystems:

```
neucore/
├── src/
│   ├── core/                  # Core framework functionality
│   │   ├── memory/            # Memory management
│   │   ├── context/           # Context building
│   │   ├── reasoning/         # Reasoning system
│   │   ├── actions/           # Action system 
│   │   ├── rag/               # Retrieval Augmented Generation
│   │   ├── goals/             # Goal management
│   │   ├── providers/         # Model providers (LLM integration)
│   │   ├── relationships/     # Entity relationships
│   │   ├── database/          # Database abstraction
│   │   ├── logging/           # Logging system
│   │   ├── config/            # Configuration management
│   │   └── errors/            # Error handling
│   ├── mcp/                   # Model Context Protocol
│   │   ├── intent.ts          # Intent definition
│   │   ├── intentFilter.ts    # Intent filtering
│   │   ├── intentHandler.ts   # Intent handling
│   │   ├── intentRouter.ts    # Intent routing
│   │   └── interfaces/        # Interface definitions
│   └── types/                 # Common type definitions
```

## Core Systems

### 1. Memory System

The Memory System provides long-term storage and retrieval of information with semantic search capabilities.

#### Key Components:
- **MemoryManager**: Stores and retrieves memories with vector embeddings
- **Memory Types**: Messages, Summaries, Facts, Documents, Knowledge, Reflections
- **Embeddings**: Vector representation of memories for semantic search

#### Example Usage:
```typescript
import { MemoryManager } from 'neucore';

const memoryManager = new MemoryManager(database, embeddingProvider);

// Create memory
await memoryManager.createMemory({
  userId: "user123",
  roomId: "room456",
  content: { text: "Paris is the capital of France", role: "system" },
  type: MemoryType.FACT
});

// Search memories semantically
const results = await memoryManager.searchMemoriesByEmbedding(
  queryEmbedding,
  { roomId: "room456", count: 5 }
);
```

### 2. Context Building System

The Context Building System intelligently selects relevant information to include in LLM prompts.

#### Key Components:
- **ContextBuilder**: Creates context for AI interactions
- **Context Sources**: Memory, Knowledge Base, Goals, User Profiles
- **Context Assembly**: Combines and prioritizes context items

#### Example Usage:
```typescript
import { createContextBuilder } from 'neucore';

const contextBuilder = createContextBuilder({
  memoryManager,
  ragManager,
  goalsManager,
  userProfileManager
});

const context = await contextBuilder.buildContext({
  userId: "user123", 
  query: "What restaurants did I like in Paris?",
  maxTokens: 2000
});
```

### 3. Reasoning System

The Reasoning System provides structured approaches to complex reasoning and problem-solving.

#### Key Components:
- **Reasoners**: Implementations of reasoning methods (Chain of Thought, etc.)
- **Reasoning Graph**: Representation of reasoning steps and connections
- **Task Planning**: Breaking down complex problems into manageable tasks

#### Example Usage:
```typescript
import { ChainOfThoughtReasoner, ReasoningMethod } from 'neucore';

const reasoner = new ChainOfThoughtReasoner(modelProvider, {
  method: ReasoningMethod.CHAIN_OF_THOUGHT
});

const result = await reasoner.reason("How can I optimize my database queries?", {
  methodOptions: {
    stepCount: 5,
    enableTaskPlanning: true
  }
});
```

### 4. Action System

The Action System defines and executes concrete operations for the AI to perform.

#### Key Components:
- **ActionManager**: Registers and manages available actions
- **Action Definitions**: Structured metadata about actions
- **Action Executors**: Functions that perform actions
- **Authorization**: Permission checks for actions

#### Example Usage:
```typescript
import { ActionManager } from 'neucore';

const actionManager = new ActionManager(permissionManager);

// Register an action
actionManager.registerAction({
  definition: {
    id: "send_email",
    name: "Send Email",
    description: "Sends an email to specified recipients",
    parameters: [
      { name: "to", description: "Recipient email", required: true, type: "string" },
      { name: "subject", description: "Email subject", required: true, type: "string" },
      { name: "body", description: "Email content", required: true, type: "string" }
    ],
    effects: ["network", "notification"],
    requiredPermissions: ["email:send"],
    enabled: true,
    visible: true
  },
  execute: async (params, context) => {
    // Implementation to send email
    return { success: true, data: { messageId: "msg123" } };
  }
});

// Execute an action
const result = await actionManager.executeAction(
  "send_email",
  { to: "user@example.com", subject: "Hello", body: "Test message" },
  { userId: "user123", agentId: "agent456" }
);
```

### 5. Retrieval Augmented Generation (RAG) System

The RAG System enhances AI responses with knowledge retrieval and processing.

#### Key Components:
- **KnowledgeManager**: Manages knowledge sources and retrieval
- **Preprocessing**: Chunking, filtering, and embedding of documents
- **Postprocessing**: Reranking, filtering, and assembly of retrieval results

#### Example Usage:
```typescript
import { createRAGKnowledgeManager } from 'neucore';

const ragManager = createRAGKnowledgeManager({
  database,
  embeddingProvider
});

// Index a document
await ragManager.indexDocument({
  id: "doc123",
  title: "Company Policy",
  content: "Full document content here...",
  metadata: { source: "internal", department: "HR" }
});

// Query knowledge
const results = await ragManager.queryKnowledge({
  query: "What is our remote work policy?",
  filters: { department: "HR" },
  limit: 5
});
```

### 6. Goal Management System

The Goal Management System tracks and manages objectives for agents and users.

#### Key Components:
- **GoalManager**: Creates and tracks goals and objectives
- **Goal States**: Creation, Progress Tracking, Completion
- **Goal Integration**: Connection with reasoning and action systems

#### Example Usage:
```typescript
import { GoalManager, GoalStatus } from 'neucore';

const goalManager = new GoalManager(database);

// Create a goal
const goal = await goalManager.createGoal({
  userId: "user123",
  name: "Improve Application Performance",
  description: "Optimize the application to reduce load times by 30%",
  objectives: [
    { description: "Identify performance bottlenecks", completed: false },
    { description: "Implement caching strategy", completed: false }
  ]
});

// Update goal progress
await goalManager.updateObjectiveStatus(goal.id, goal.objectives[0].id, true);
```

### 7. Model Provider System

The Model Provider System provides a unified interface to different LLM providers.

#### Key Components:
- **ModelProvider Interface**: Common API for model interactions
- **Provider Implementations**: Anthropic, OpenAI, etc.
- **Provider Factory**: Creates providers based on configuration

#### Example Usage:
```typescript
import { createProviderFactory } from 'neucore';

const providerFactory = createProviderFactory({
  anthropic: {
    apiKey: "your-anthropic-key",
    defaultModel: "claude-3-opus-20240229"
  },
  defaultProvider: "anthropic"
});

// Get a provider
const provider = providerFactory.getProvider();

// Generate completion
const response = await provider.generateCompletion({
  prompt: "Explain quantum computing in simple terms",
  max_tokens: 500,
  temperature: 0.7
});
```

## Model Context Protocol (MCP)

The Model Context Protocol provides a standardized system for managing context between LLMs and applications, enabling structured communication and consistent context handling.

### Key Components:
- **Intent**: Structure representing user or system intentions
- **IntentFilter**: Rules for matching intents
- **IntentHandler**: Logic for processing matched intents
- **IntentRouter**: Routes intents to appropriate handlers
- **Context Management**: Utilities for building and maintaining context
- **Protocol Structure**: Standardized format for model-application communication

### Example Usage:
```typescript
import { createIntentRouter, BaseIntentHandler } from 'neucore';

const router = createIntentRouter();

// Create a handler
class SearchHandler extends BaseIntentHandler {
  async handle(intent, context) {
    // Implementation to handle search intent
    return { success: true, data: { results: [] } };
  }
}

// Register with the router
router.registerHandler(
  new SearchHandler(),
  { intentType: "search", confidence: 0.6 }
);

// Route an intent
const result = await router.route({
  type: "search",
  parameters: { query: "machine learning papers" }
}, {
  userId: "user123"
});
```

## Integration and Workflow

### System Workflow
1. **Input Processing**: User messages are processed and understood
2. **Intent Identification**: The Model Context Protocol identifies user intentions
3. **Context Building**: Relevant context is assembled
4. **Reasoning**: Complex problems are reasoned through
5. **Action Execution**: Concrete actions are performed
6. **Response Generation**: Responses are generated and delivered

### Integration Example
```typescript
// Initialize components
const dbService = new DatabaseService(dbAdapter);
const memoryManager = new MemoryManager(dbService, embedder);
const contextBuilder = createContextBuilder({ memoryManager, ragManager });
const providerFactory = createProviderFactory({ anthropic: { apiKey: "key" } });
const modelProvider = providerFactory.getProvider();
const reasoner = new ChainOfThoughtReasoner(modelProvider);
const actionManager = new ActionManager();
const intentRouter = createIntentRouter();

// Process user message
async function processMessage(userId, message) {
  // 1. Create memory
  await memoryManager.createMemory({
    userId,
    roomId: "room123",
    content: { text: message, role: "user" }
  });
  
  // 2. Build context
  const context = await contextBuilder.buildContext({
    userId,
    query: message
  });
  
  // 3. Identify intent
  const intent = await intentRouter.identifyIntent(message, context);
  
  // 4. Process based on intent type
  if (intent.type === "question") {
    // Use reasoning for complex questions
    const reasoningResult = await reasoner.reason(message, {
      methodOptions: { stepCount: 3 }
    });
    return reasoningResult.conclusion;
  } else {
    // Use action system for task-oriented intents
    const result = await actionManager.executeAction(
      intent.actionId,
      intent.parameters,
      { userId }
    );
    return result.data;
  }
}
```

## Advanced Features

### 1. Relationship Mapping
The system can track and utilize relationships between entities for more contextually aware responses.

### 2. Knowledge Graph Integration
Integration with knowledge graphs for enhanced understanding and reasoning capabilities.

### 3. Multi-Agent Collaboration
Support for multiple agents working together to solve complex problems.

### 4. Adaptive Context Selection
Dynamic adjustment of context based on interaction patterns and importance.

### 5. Memory Consolidation
Automatic summarization and organization of memories over time for improved efficiency.

## Best Practices

1. **Modular Design**: Use factory functions to create loosely coupled components
2. **Error Handling**: Implement robust error handling and logging
3. **Testing**: Unit test each component with mocked dependencies
4. **Security**: Validate inputs and check permissions before executing actions
5. **Performance**: Use efficient context strategies to minimize token usage
6. **Observability**: Instrument code with logging and metrics

## Conclusion

neucore provides a comprehensive framework for building sophisticated AI applications with context awareness, reasoning capabilities, and task-oriented behaviors. By leveraging these interconnected systems, developers can create AI solutions that are more capable, contextually relevant, and effective at solving complex problems. 