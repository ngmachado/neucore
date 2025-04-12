/**
 * Intent System Usage Example
 * 
 * This file demonstrates how to use the NeuroCore intent system
 * by setting up handlers and sending intents.
 */

import { IntentRouter, Intent } from '..';
import { AnthropicHandler } from './anthropicHandler';

/**
 * Run the example
 */
async function runExample() {
    console.log('NeuroCore Intent System Example');
    console.log('-------------------------------');

    // Create an intent router
    const router = new IntentRouter();

    // Register handlers
    const anthropicHandler = new AnthropicHandler('dummy-api-key');
    await router.registerHandler(anthropicHandler);

    console.log('\nExample 1: Basic text generation');
    console.log('--------------------------------');

    // Create an intent for text generation
    const generateIntent = new Intent('anthropic:generate', {
        prompt: 'Write a haiku about programming'
    });

    // Add categories and extras
    generateIntent.addCategory('ai');
    generateIntent.putExtra('model', 'claude-3-haiku-20240307');
    generateIntent.putExtra('maxTokens', 100);

    // Send the intent
    const generateResults = await router.sendIntent(generateIntent, {
        userId: 'example-user'
    });

    // Display results
    console.log('Results:', JSON.stringify(generateResults, null, 2));

    console.log('\nExample 2: Chat completion');
    console.log('-------------------------');

    // Create an intent for chat
    const chatIntent = new Intent('anthropic:chat');
    chatIntent.putExtra('messages', [
        { role: 'user', content: 'Hello, how can you help me with NeuroCore?' }
    ]);
    chatIntent.putExtra('system', 'You are an AI assistant helping with NeuroCore framework.');

    // Send the intent
    const chatResults = await router.sendIntent(chatIntent, {
        userId: 'example-user'
    });

    // Display results
    console.log('Results:', JSON.stringify(chatResults, null, 2));

    console.log('\nExample 3: Embedding generation');
    console.log('------------------------------');

    // Create an intent for embeddings
    const embeddingIntent = new Intent('anthropic:embedding', {
        text: 'This is a sample text to convert into an embedding vector.'
    });

    // Send the intent
    const embeddingResults = await router.sendIntent(embeddingIntent);

    // Display results (truncate the embedding for readability)
    const resultCopy = JSON.parse(JSON.stringify(embeddingResults));
    if (resultCopy[0]?.data?.embedding) {
        resultCopy[0].data.embedding = [
            ...resultCopy[0].data.embedding.slice(0, 3),
            '... (truncated for readability)',
            ...resultCopy[0].data.embedding.slice(-3)
        ];
    }
    console.log('Results:', JSON.stringify(resultCopy, null, 2));

    console.log('\nExample 4: Broadcast to multiple handlers');
    console.log('---------------------------------------');

    // In a real application, you would register multiple handlers
    // that respond to the same intent action

    // Create a broadcast intent
    const broadcastIntent = new Intent('system:statusCheck');
    broadcastIntent.addCategory('system');

    // Send as broadcast (to all matching handlers)
    const broadcastResults = await router.sendBroadcast(broadcastIntent);

    // Display results
    console.log('Results:', JSON.stringify(broadcastResults, null, 2));
}

// Run the example if this file is executed directly
if (require.main === module) {
    runExample().catch(err => {
        console.error('Error running example:', err);
    });
}

export { runExample }; 