# NeuroCore Reasoning System

The NeuroCore Reasoning System provides a structured approach to AI reasoning through different reasoning methods that enhance decision-making and planning capabilities.

> **Navigation**: [Back to README](../README.md) | [System Documentation](SYSTEM-DOCUMENTATION.md) | [Implementation Guide](IMPLEMENTATION-GUIDE.md) | [Future Methods](README-future-methods.md)

## Core Components

### Reasoning Graph
The reasoning process is represented as a graph with nodes (reasoning steps) and edges (connections between steps):
- **Nodes**: Individual reasoning steps (observations, analyses, inferences, etc.)
- **Edges**: Relationships between reasoning steps

### Reasoner Interface
All reasoners implement a common interface (`IReasoner`) with these operations:
- `getMethod()`: Returns the reasoning method type
- `reason(query, options)`: Performs reasoning on a query
- `continueReasoning(graph, options)`: Continues reasoning from an existing graph
- `setProgressCallback(callback)`: Sets a callback for progress updates

### Reasoning Methods
NeuroCore supports multiple reasoning approaches:
- **Chain of Thought**: Step-by-step reasoning (implemented)
- **Tree of Thought**: Exploring multiple reasoning paths (planned)
- **ReAct**: Reasoning and Acting in alternating sequence (planned)
- **Socratic**: Query-based reasoning through questions (planned)
- **First Principles**: Breaking down problems to fundamental elements (planned)
- **Reflexion**: Self-critical reasoning with reflection (planned)

## Chain of Thought Reasoner

The Chain of Thought reasoner implements step-by-step reasoning by encouraging models to break down complex reasoning into explicit steps.

### Features

- **Step-by-step reasoning**: Breaks down complex reasoning into manageable steps
- **Confidence scoring**: Assigns confidence values to conclusions
- **Verification**: Optional verification step to validate reasoning
- **Multiple chains**: Can generate multiple reasoning chains and select the best one
- **Progress tracking**: Provides updates during the reasoning process

### Task Planning and Goal Orientation

The Chain of Thought reasoner supports task planning and goal orientation to enhance its capabilities for solving complex problems:

#### Task Planning Features

- **Task Plan Generation**: Automatically generates a structured task plan at the beginning of the reasoning process
- **Decomposition**: Breaks down complex tasks into manageable subtasks
- **Dependency Tracking**: Identifies dependencies between tasks
- **Complexity Assessment**: Estimates complexity of each task (LOW, MEDIUM, HIGH)
- **Prioritization**: Can prioritize tasks based on importance and dependencies

#### Goal Orientation Features

- **Goal Context**: Provides goal context to guide the reasoning process
- **Objective Tracking**: Aligns reasoning with specific objectives
- **Progress Tracking**: Monitors progress toward goal completion
- **Goal Metadata**: Stores goal information in the reasoning graph
- **Objective Updates**: Can update objective completion status

## Usage Example

Here's a basic example of using the Chain of Thought reasoner with task planning and goal orientation:

```typescript
import { ChainOfThoughtReasoner } from '../reasoning/chainOfThoughtReasoner';
import { ReasoningMethod } from '../reasoning/types';
import { Goal, GoalStatus } from '../../types/goals';
import { IModelProvider } from '../providers/modelProvider';

// Create a model provider instance
const modelProvider: IModelProvider = /* your model provider */;

// Create a reasoner
const reasoner = new ChainOfThoughtReasoner(modelProvider, {
    method: ReasoningMethod.CHAIN_OF_THOUGHT
});

// Define a goal
const goal: Goal = {
    id: "goal-123",
    contextId: "context-456",
    userId: "user-789",
    name: "Improve Application Performance",
    description: "Optimize the application to reduce load times by 30%",
    status: GoalStatus.IN_PROGRESS,
    objectives: [
        {
            id: "obj-1",
            description: "Identify performance bottlenecks",
            completed: false
        },
        {
            id: "obj-2",
            description: "Implement caching strategy",
            completed: false
        }
    ]
};

// Use with task planning and goal orientation
const result = await reasoner.reason("How can I improve the performance of my React application?", {
    methodOptions: {
        stepCount: 5,
        enableTaskPlanning: true,
        goal: goal,
        taskPlanningOptions: {
            maxTasks: 6,
            decomposeComplexTasks: true,
            prioritizeTasks: true
        }
    }
});

// Get the conclusion
console.log(result.conclusion);

// Access the task plan
console.log(result.graph.metadata?.taskPlan);

// Check updated goal progress
console.log(goal.objectives);
```

## Reasoning Process Flow

1. **Initialization**: Create a reasoning graph with the query
2. **Task Planning** (if enabled): Generate a structured task plan
3. **Step Generation**: Generate reasoning steps sequentially
4. **Conclusion**: Derive a conclusion from the reasoning steps
5. **Verification** (if enabled): Verify the conclusion against the steps
6. **Goal Update** (if enabled): Update goal progress based on reasoning

## Advanced Configuration

The reasoner can be configured with various options:

```typescript
// Advanced configuration example
const result = await reasoner.reason(query, {
    maxDepth: 15,             // Maximum reasoning depth
    maxIterations: 20,        // Maximum iterations
    temperature: 0.5,         // Temperature for generation
    enableReflection: true,   // Enable self-reflection
    confidenceThreshold: 0.9, // Confidence threshold for early stopping
    methodOptions: {
        stepCount: 7,               // Number of steps to generate
        includeVerification: true,  // Include verification step
        multipleChains: true,       // Generate multiple chains
        chainCount: 3,              // Number of chains to generate
        enableTaskPlanning: true,   // Enable task planning
        taskPlanningOptions: {
            maxTasks: 8,
            decomposeComplexTasks: true,
            prioritizeTasks: true
        }
    }
});
```

## Integration with NeuroCore Ecosystem

The reasoning system integrates with other NeuroCore components:

- **Goal Management**: Updates goal progress based on reasoning outcomes
- **Memory System**: Can access and update memory during reasoning
- **Context Building**: Uses context to inform the reasoning process
- **Action System**: Can trigger actions based on reasoning conclusions

## Future Enhancements

Planned enhancements for the reasoning system:

1. Implementation of additional reasoning methods
2. Enhanced visualization of reasoning graphs
3. Improved confidence estimation
4. More advanced task planning capabilities
5. Multi-agent collaborative reasoning
6. Integration with external knowledge sources 