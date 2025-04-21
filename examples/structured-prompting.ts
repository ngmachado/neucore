/**
 * Structured Prompting Example
 * 
 * This example demonstrates how to use the PromptBuilder and TextPreprocessor
 * to create and process structured prompts with XML-like markup.
 */

import {
    createPromptBuilder,
    createTextPreprocessor,
    PromptBuilder,
    TextPreprocessor
} from '../src/core/preprocessing';

// Example function to simulate getting content from a file
function getFileContent(path: string): string {
    return `function greet(name: string) {
  console.log(\`Hello, \${name}!\`);
}

greet('World');
`;
}

/**
 * Simple example that demonstrates building and processing a structured prompt
 */
async function runExample() {
    console.log('Structured Prompting Example');
    console.log('============================');

    // Step 1: Create a structured prompt
    const promptBuilder = createPromptBuilder({
        maxFiles: 5,
        maxErrors: 10
    });

    // Add user query
    promptBuilder.withUserQuery('How can I improve this code?');

    // Add custom instructions
    promptBuilder.withCustomInstructions(
        'Focus on code quality and best practices when making suggestions.'
    );

    // Add current file context
    promptBuilder.withCurrentFile({
        path: 'src/greet.ts',
        line: 2,
        lineContent: '  console.log(`Hello, ${name}!`);',
        content: getFileContent('src/greet.ts')
    });

    // Add a related file for context
    promptBuilder.withAttachedFile({
        path: 'src/logger.ts',
        content: `export function log(message: string) {
  console.log(\`[LOG]: \${message}\`);
}
`
    });

    // Add some linter errors
    promptBuilder.withLinterErrors([
        {
            file: 'src/greet.ts',
            line: 2,
            message: 'Prefer string interpolation over concatenation',
            severity: 1
        }
    ]);

    // Step 2: Serialize the prompt to XML-like format
    const serializedPrompt = promptBuilder.serialize();
    console.log('\nSerialized Prompt:');
    console.log('----------------');
    console.log(serializedPrompt);

    // Step 3: Process the serialized prompt
    const textPreprocessor = createTextPreprocessor({
        parseXmlTags: true,
        parseMarkdown: true,
        extractMetadata: true
    });

    const preprocessingResult = textPreprocessor.process(serializedPrompt);

    console.log('\nPreprocessing Result:');
    console.log('------------------');
    console.log('Extracted Tags:', preprocessingResult.metadata.extractedTags);
    console.log('Detected Languages:', preprocessingResult.metadata.detectedLanguages);
    console.log('Processing Time:', preprocessingResult.metadata.processingTime, 'ms');

    // Print the structured data (partial)
    console.log('\nExtracted Structured Data:');
    console.log('------------------------');

    if (preprocessingResult.structuredData.tags?.user_query) {
        console.log('User Query:', preprocessingResult.structuredData.tags.user_query);
    }

    if (preprocessingResult.structuredData.tags?.custom_instructions) {
        console.log('Custom Instructions:', preprocessingResult.structuredData.tags.custom_instructions);
    }

    // Now we could send this to an AI model
    console.log('\nIn a real application, you would now:');
    console.log('1. Send the structured prompt to an AI model');
    console.log('2. Process the AI response');
    console.log('3. Display the results to the user');
}

// Run the example
runExample().catch(error => {
    console.error('Error running example:', error);
}); 