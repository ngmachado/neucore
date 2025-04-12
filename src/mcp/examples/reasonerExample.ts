/**
 * Chain of Thought Reasoner Example with Task Planning
 * 
 * This file demonstrates how to use the NeuroCore Chain of Thought reasoner
 * with task planning and goal orientation features.
 */

import { ChainOfThoughtReasoner } from '../../core/reasoning/chainOfThoughtReasoner';
import { ReasoningMethod } from '../../core/reasoning/types';
import { GenericModelProvider } from '../../core/providers/genericModelProvider';
import { Goal, GoalStatus } from '../../types/goals';
import { UUID } from '../../types';

/**
 * Helper function to generate a UUID (simplified for example)
 */
function generateUUID(): UUID {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    }) as UUID;
}

/**
 * Run the Chain of Thought reasoner example
 */
async function runChainOfThoughtExample() {
    console.log('NeuroCore Chain of Thought Reasoner Example');
    console.log('-------------------------------------------');

    // Create a model provider
    // Note: In a real application, you would use a specific provider implementation
    const modelProvider = new GenericModelProvider({
        apiKey: 'your-api-key', // Replace with a real API key
        defaultModel: 'gpt-4'
    });

    // Create a reasoner
    const reasoner = new ChainOfThoughtReasoner(modelProvider, {
        method: ReasoningMethod.CHAIN_OF_THOUGHT,
        temperature: 0.7,
        maxDepth: 8,
        enableReflection: true
    });

    // Set up a progress callback
    reasoner.setProgressCallback((progress) => {
        console.log(`Step ${progress.stepNumber}: ${progress.currentStep.description}`);
    });

    // Example 1: Basic Chain of Thought reasoning
    console.log('\nExample 1: Basic Chain of Thought reasoning');
    console.log('------------------------------------------');

    const basicQuery = 'What is the square root of 144, and why is it significant in geometry?';

    const basicResult = await reasoner.reason(basicQuery, {
        methodOptions: {
            stepCount: 3,
            includeVerification: true
        }
    });

    // Display results
    console.log('Conclusion:', basicResult.conclusion);
    console.log('Confidence:', basicResult.confidence);
    console.log('Step Count:', basicResult.stepCount);
    console.log('Time Taken:', basicResult.timeTaken, 'ms');

    // Example 2: Task planning based reasoning
    console.log('\nExample 2: Task planning based reasoning');
    console.log('--------------------------------------');

    const planningQuery = 'Design a simple Python application to track daily water intake with data visualization';

    const planningResult = await reasoner.reason(planningQuery, {
        methodOptions: {
            stepCount: 4,
            enableTaskPlanning: true,
            taskPlanningOptions: {
                maxTasks: 5,
                decomposeComplexTasks: true
            }
        }
    });

    // Display results
    console.log('Task Plan:');
    console.log(planningResult.graph.metadata?.taskPlan?.content);
    console.log('\nConclusion:', planningResult.conclusion);
    console.log('Confidence:', planningResult.confidence);

    // Example 3: Goal-oriented reasoning
    console.log('\nExample 3: Goal-oriented reasoning');
    console.log('----------------------------------');

    // Create a sample goal
    const sampleGoal: Goal = {
        id: generateUUID(),
        contextId: generateUUID(),
        userId: 'user-1',
        name: 'Improve Home Energy Efficiency',
        description: 'Find ways to reduce home energy consumption by at least 20%',
        status: GoalStatus.IN_PROGRESS,
        objectives: [
            {
                id: generateUUID(),
                description: 'Identify the top 3 sources of energy consumption',
                completed: false,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                id: generateUUID(),
                description: 'Recommend cost-effective improvements with ROI calculations',
                completed: false,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                id: generateUUID(),
                description: 'Create a month-by-month implementation schedule',
                completed: false,
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ],
        priority: 2,
        createdAt: new Date(),
        updatedAt: new Date()
    };

    const goalQuery = 'How can I make my home more energy efficient?';

    const goalResult = await reasoner.reason(goalQuery, {
        methodOptions: {
            stepCount: 5,
            enableTaskPlanning: true,
            goal: sampleGoal,
            taskPlanningOptions: {
                maxTasks: 6,
                decomposeComplexTasks: true,
                prioritizeTasks: true
            }
        }
    });

    // Display results
    console.log('Task Plan:');
    console.log(goalResult.graph.metadata?.taskPlan?.content);
    console.log('\nConclusion:', goalResult.conclusion);
    console.log('Confidence:', goalResult.confidence);

    // Example 4: Combined approach with continued reasoning
    console.log('\nExample 4: Continued goal-oriented reasoning');
    console.log('------------------------------------------');

    // Continue reasoning from previous result
    const continuedResult = await reasoner.continueReasoning(goalResult.graph, {
        methodOptions: {
            stepCount: 3,
            includeVerification: true,
            goal: sampleGoal
        }
    });

    // Display results
    console.log('Additional Reasoning:');
    const lastNode = continuedResult.graph.nodes[continuedResult.graph.nodes.length - 2];
    console.log(lastNode.content);
    console.log('\nUpdated Conclusion:', continuedResult.conclusion);
    console.log('Final Confidence:', continuedResult.confidence);
}

// Run the example if this file is executed directly
if (require.main === module) {
    runChainOfThoughtExample().catch(err => {
        console.error('Error running example:', err);
    });
}

export { runChainOfThoughtExample }; 