import { MIP } from '../mip';
import { createMIPIntent } from '../interfaces/intent';
import { ModelSelectionCriteria } from '../types/modelSelection';

async function runModelSelectionExample() {
    const mip = new MIP();
    await mip.initialize();

    // Example 1: Binary classification with high performance requirements
    const classificationCriteria: ModelSelectionCriteria = {
        taskType: 'classification',
        performanceRequirements: {
            maxLatency: 150,
            minQuality: 0.9
        },
        specificRequirements: {
            classificationType: 'binary'
        }
    };

    // Create simplified MIP intent with model-selection action
    const classificationIntent = createMIPIntent('model-selection', classificationCriteria);
    const classificationResult = await mip.executeIntent(classificationIntent);
    console.log('Classification Model Selection:', classificationResult);

    // Example 2: Long-form generation with standard performance
    const generationCriteria: ModelSelectionCriteria = {
        taskType: 'generation',
        performanceRequirements: {
            maxLatency: 300,
            minQuality: 0.8
        },
        specificRequirements: {
            generationType: 'long'
        }
    };

    // Create simplified MIP intent with model-selection action
    const generationIntent = createMIPIntent('model-selection', generationCriteria);
    const generationResult = await mip.executeIntent(generationIntent);
    console.log('Generation Model Selection:', generationResult);

    // Example 3: Invalid criteria to demonstrate validation
    try {
        // Missing required taskType field
        const invalidCriteria1 = {
            performanceRequirements: {
                maxLatency: 200
            }
        };
        const invalidIntent1 = createMIPIntent('model-selection', invalidCriteria1);
        const result1 = await mip.executeIntent(invalidIntent1);
        console.log('This should not be reached:', result1);
    } catch (err) {
        const error = err as Error;
        console.log('Validation caught missing taskType:', error.message);
    }

    try {
        // Invalid task type
        const invalidCriteria2: any = {
            taskType: 'invalid-type',
            performanceRequirements: {
                maxLatency: 200
            }
        };
        const invalidIntent2 = createMIPIntent('model-selection', invalidCriteria2);
        const result2 = await mip.executeIntent(invalidIntent2);
        console.log('This should not be reached:', result2);
    } catch (err) {
        const error = err as Error;
        console.log('Validation caught invalid task type:', error.message);
    }

    try {
        // Invalid performance requirements
        const invalidCriteria3: ModelSelectionCriteria = {
            taskType: 'classification',
            performanceRequirements: {
                maxLatency: -100,  // Invalid: negative latency
                minQuality: 1.5    // Invalid: quality > 1
            }
        };
        const invalidIntent3 = createMIPIntent('model-selection', invalidCriteria3);
        const result3 = await mip.executeIntent(invalidIntent3);
        console.log('This should not be reached:', result3);
    } catch (err) {
        const error = err as Error;
        console.log('Validation caught invalid performance requirements:', error.message);
    }
}

runModelSelectionExample().catch(console.error); 