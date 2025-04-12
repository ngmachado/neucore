# NeuroCore Reasoner Implementation Guide

This guide provides step-by-step instructions for implementing new reasoning methods in the NeuroCore reasoning system.

> **Navigation**: [Back to README](../README.md) | [Reasoning Documentation](REASONING.md) | [Future Methods](README-future-methods.md)

## Prerequisites

1. Understand the reasoning system architecture:
   - `IReasoner` interface
   - `BaseReasoner` abstract class
   - Reasoning types and data structures

2. Familiarity with the reasoning method you want to implement.

## Implementation Steps

### 1. Create a New Reasoner Class

Create a new TypeScript file for your reasoner that extends the `BaseReasoner` abstract class:

```typescript
import { BaseReasoner, ReasoningResult } from './reasoner';
import { ReasoningGraph, ReasoningMethod, ReasoningOptions, ReasoningNodeType } from './types';
import { IModelProvider } from '../providers/modelProvider';

export class YourNewReasoner extends BaseReasoner {
    constructor(modelProvider: IModelProvider, defaultOptions: Partial<ReasoningOptions>) {
        super(modelProvider, defaultOptions);
    }

    getMethod(): ReasoningMethod {
        return ReasoningMethod.YOUR_METHOD; // Use existing or add new method to enum
    }

    async reason(query: string, options?: Partial<ReasoningOptions>): Promise<ReasoningResult> {
        // Implement your reasoning logic here
    }

    async continueReasoning(graph: ReasoningGraph, options?: Partial<ReasoningOptions>): Promise<ReasoningResult> {
        // Implement logic to continue reasoning from an existing graph
    }
}
```

### 2. Define Method-Specific Options

If your reasoning method requires specific options, define an interface:

```typescript
export interface YourMethodOptions {
    // Define method-specific options
    optionA?: boolean;
    optionB?: number;
    // ...etc
}
```

### 3. Implement the `reason` Method

The `reason` method is the core of your reasoner. Implement it following this structure:

```typescript
async reason(query: string, options?: Partial<ReasoningOptions>): Promise<ReasoningResult> {
    const startTime = Date.now();

    // 1. Merge options
    const mergedOptions: ReasoningOptions = {
        ...this.defaultOptions,
        ...options,
        method: ReasoningMethod.YOUR_METHOD
    };

    // 2. Extract method-specific options
    const methodOptions = mergedOptions.methodOptions as YourMethodOptions || {};
    
    // 3. Create a new reasoning graph
    const graph = this.createGraph(query, ReasoningMethod.YOUR_METHOD);

    try {
        // 4. Implement your reasoning logic
        // ... your reasoning implementation ...

        // 5. Generate a conclusion
        const conclusion = ""; // Your conclusion
        const confidence = 0.0; // Your confidence value
        
        // 6. Set the conclusion in the graph
        graph.conclusion = conclusion;

        const endTime = Date.now();

        // 7. Return the result
        return {
            graph,
            conclusion,
            confidence,
            timeTaken: endTime - startTime,
            stepCount: graph.nodes.length,
            success: true
        };
    } catch (error) {
        const endTime = Date.now();
        
        // 8. Handle errors
        return {
            graph,
            conclusion: "",
            confidence: 0,
            timeTaken: endTime - startTime,
            stepCount: graph.nodes.length,
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}
```

### 4. Implement `continueReasoning`

The `continueReasoning` method should allow resuming reasoning from an existing graph:

```typescript
async continueReasoning(
    graph: ReasoningGraph,
    options?: Partial<ReasoningOptions>
): Promise<ReasoningResult> {
    const startTime = Date.now();
    
    // 1. Validate the input graph
    if (graph.method !== this.getMethod()) {
        throw new Error(`Cannot continue reasoning: graph uses method ${graph.method} but this reasoner implements ${this.getMethod()}`);
    }
    
    // 2. Merge options
    const mergedOptions: ReasoningOptions = {
        ...this.defaultOptions,
        ...options,
        method: this.getMethod()
    };
    
    try {
        // 3. Continue reasoning from the existing graph
        // ... your continuation logic ...
        
        // 4. Generate or update conclusion
        const conclusion = ""; // Updated conclusion
        const confidence = 0.0; // Updated confidence
        
        // 5. Update the graph
        graph.conclusion = conclusion;
        graph.updatedAt = Date.now();
        
        const endTime = Date.now();
        
        // 6. Return the result
        return {
            graph,
            conclusion,
            confidence,
            timeTaken: endTime - startTime,
            stepCount: graph.nodes.length,
            success: true
        };
    } catch (error) {
        const endTime = Date.now();
        
        return {
            graph,
            conclusion: graph.conclusion || "",
            confidence: 0,
            timeTaken: endTime - startTime,
            stepCount: graph.nodes.length,
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}
```

### 5. Implement Private Helper Methods

Implement private helper methods for your reasoning logic:

```typescript
private async generateStep(
    graph: ReasoningGraph,
    stepNumber: number,
    previousSteps: string[],
    options: ReasoningOptions
): Promise<string> {
    // Implement step generation logic
}

private getPrompt(
    query: string,
    previousSteps: string[],
    options: ReasoningOptions
): string {
    // Construct prompt for your reasoning method
}

// Add other helper methods as needed
```

### 6. Utilize the Model Provider

Use the model provider for generating text:

```typescript
private async callModel(prompt: string, options: ReasoningOptions): Promise<string> {
    const result = await this.modelProvider.complete({
        prompt,
        temperature: options.temperature || 0.7,
        max_tokens: 1000, // Adjust as needed
        stop_sequences: ["STEP:", "CONCLUSION:"] // Adjust as needed
    });
    
    return result.text;
}
```

### 7. Use Utility Methods from BaseReasoner

Utilize the utility methods provided by `BaseReasoner`:

- `createGraph`: Create a new reasoning graph
- `addNode`: Add a node to the graph
- `addEdge`: Add an edge between nodes
- `createStep`: Create a reasoning step
- `reportProgress`: Report progress via callback
- `generateId`: Generate a unique ID

### 8. Update Types (if needed)

If your reasoning method requires new node types or other data structures, update the type definitions in `types.ts`.

## Testing Your Reasoner

Create unit tests for your reasoner:

```typescript
import { YourNewReasoner } from './yourNewReasoner';
import { MockModelProvider } from '../../test/mocks';

describe('YourNewReasoner', () => {
    let reasoner: YourNewReasoner;
    let mockModelProvider: MockModelProvider;
    
    beforeEach(() => {
        mockModelProvider = new MockModelProvider();
        reasoner = new YourNewReasoner(mockModelProvider, {});
    });
    
    test('getMethod returns correct method type', () => {
        expect(reasoner.getMethod()).toBe(ReasoningMethod.YOUR_METHOD);
    });
    
    test('reason produces valid reasoning result', async () => {
        // Mock model responses
        mockModelProvider.setResponses([
            "Step 1 response",
            "Step 2 response",
            // ...
            "Conclusion response"
        ]);
        
        const result = await reasoner.reason("Test query");
        
        expect(result.success).toBe(true);
        expect(result.conclusion).toBeTruthy();
        expect(result.graph.nodes.length).toBeGreaterThan(0);
        // Add more assertions
    });
    
    // Add more tests
});
```

## Example: Implementing Tree of Thought Reasoner

Here's a skeleton example for implementing a Tree of Thought reasoner:

```typescript
import { BaseReasoner, ReasoningResult } from './reasoner';
import {
    ReasoningGraph,
    ReasoningMethod,
    ReasoningOptions,
    ReasoningNodeType,
    ReasoningNode
} from './types';
import { IModelProvider } from '../providers/modelProvider';

export interface TreeOfThoughtOptions {
    maxBranches?: number;
    evaluationSteps?: number;
    pruningThreshold?: number;
}

export class TreeOfThoughtReasoner extends BaseReasoner {
    getMethod(): ReasoningMethod {
        return ReasoningMethod.TREE_OF_THOUGHT;
    }
    
    async reason(query: string, options?: Partial<ReasoningOptions>): Promise<ReasoningResult> {
        const startTime = Date.now();
        
        // Merge options
        const mergedOptions: ReasoningOptions = {
            ...this.defaultOptions,
            ...options,
            method: ReasoningMethod.TREE_OF_THOUGHT
        };
        
        // Extract ToT specific options
        const totOptions = mergedOptions.methodOptions as TreeOfThoughtOptions || {};
        const maxBranches = totOptions.maxBranches || 3;
        const pruningThreshold = totOptions.pruningThreshold || 0.3;
        
        // Create graph
        const graph = this.createGraph(query, ReasoningMethod.TREE_OF_THOUGHT);
        
        try {
            // Create root node
            const rootNode = this.addNode(
                graph,
                ReasoningNodeType.QUESTION,
                query,
                1.0
            );
            
            // Generate branches (initial steps)
            const branches = await this.generateInitialBranches(
                graph,
                rootNode,
                query,
                maxBranches,
                mergedOptions
            );
            
            // Evaluate and prune branches
            const viableBranches = await this.evaluateAndPruneBranches(
                graph,
                branches,
                pruningThreshold,
                mergedOptions
            );
            
            // Develop remaining branches
            const developedBranches = await this.developBranches(
                graph,
                viableBranches,
                mergedOptions
            );
            
            // Select best branch
            const bestBranch = await this.selectBestBranch(
                graph,
                developedBranches,
                mergedOptions
            );
            
            // Generate conclusion
            const { conclusion, confidence } = await this.generateConclusion(
                graph,
                bestBranch,
                query,
                mergedOptions
            );
            
            // Set conclusion in graph
            graph.conclusion = conclusion;
            
            const endTime = Date.now();
            
            return {
                graph,
                conclusion,
                confidence,
                timeTaken: endTime - startTime,
                stepCount: graph.nodes.length,
                success: true
            };
        } catch (error) {
            // Handle errors
        }
    }
    
    // Implement other required methods
}
```

## Integration

Once you've implemented and tested your reasoner, integrate it with the rest of the system:

1. Export your reasoner in the module's index file
2. Create examples and documentation
3. Add tests for integration with other components

## Best Practices

1. **Keep the interface consistent** - Follow the patterns established by existing reasoners
2. **Document your code thoroughly** - Add JSDoc comments to all methods and classes
3. **Handle errors gracefully** - Implement robust error handling
4. **Implement progress tracking** - Use the progress callback mechanism
5. **Test edge cases** - Test with empty inputs, large inputs, etc.
6. **Consider performance** - Be mindful of computational and memory requirements
7. **Make reasoning explainable** - Ensure the reasoning process can be understood by users
8. **Maintain type safety** - Use TypeScript types consistently 