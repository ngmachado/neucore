# Structured Context Prompting Framework

## Overview

The Structured Context Prompting Framework provides a standardized approach to constructing AI prompts with rich context, file references, and conversation history. This framework enhances AI interactions by separating metadata from user queries and maintaining consistent contextual awareness.

## Purpose

- Provide AI models with relevant context automatically
- Standardize prompt structure across the codebase
- Improve quality and relevance of AI responses
- Enable context-aware reasoning

## Multi-Layer AI Architecture

The Structured Context Prompting Framework employs a two-layer AI approach:

### Layer 1: Context Processor AI

The first AI layer is invisible to the end user and the response AI. It:
- Receives raw IDE context and user input
- Makes decisions about what context is relevant
- Selects appropriate files and code snippets
- Formats everything into the structured prompt format
- Translates technical context into natural language descriptions when needed
- Wraps content in XML-like tags (`<additional_data>`, `<current_file>`, etc.)

### Layer 2: Response Generator AI

The second AI layer (like Claude or GPT):
- Receives the already formatted prompt as plain text
- Never sees the original raw data or the rules that govern Layer 1
- Works with the pre-structured, pre-filtered context
- Focuses entirely on generating appropriate responses
- Uses the structured context to inform its answers

This cascade approach provides several advantages:
- Specialized handling at each layer
- Clear separation of concerns (context processing vs. response generation)
- More efficient use of context tokens
- Better scalability and easier maintenance
- Ability to swap out either AI layer independently

## Core Components

### Prompt Structure

The basic structure of a structured prompt:

```typescript
interface StructuredPrompt {
  conversationSummary?: string;
  customInstructions?: string;
  additionalData?: {
    currentFile?: {
      path: string;
      line?: number;
      lineContent?: string;
      selection?: {
        startLine: number;
        endLine: number;
        content: string;
      }
    }[];
    attachedFiles?: {
      path: string;
      content: string;
      lineRange?: [number, number];
    }[];
    linterErrors?: {
      file: string;
      errors: {
        line: number;
        message: string;
        severity: number;
      }[];
    }[];
    terminalOutput?: string;
  };
  userQuery: string;
}
```

### Context Types

- **Current File**: Active file the user is viewing/editing
- **Attached Files**: Related files providing additional context
- **Linter Errors**: Code quality issues in the current workspace
- **Terminal Output**: Output from previously run commands
- **Conversation Summary**: AI-generated summary of previous interactions
- **Custom Instructions**: User-specific preferences for AI behavior

## API Design

```typescript
class StructuredPromptBuilder {
  constructor(options?: PromptBuilderOptions);
  
  // Core building methods
  withUserQuery(query: string): this;
  withCurrentFile(file: FileContext): this;
  withAttachedFile(file: FileContext): this;
  withLinterErrors(errors: LinterError[]): this;
  withTerminalOutput(output: string): this;
  withConversationSummary(summary: string): this;
  withCustomInstructions(instructions: string): this;
  
  // Advanced options
  withRelevanceThreshold(threshold: number): this;
  withMaxContextLength(maxLength: number): this;
  
  // Output methods
  build(): StructuredPrompt;
  serialize(): string;
  toJSON(): string;
}
```

## Integration with MCP

The Structured Context Prompting Framework integrates with the existing Model Context Protocol (MCP):

```typescript
// Integration with MCP (Model Context Protocol)
interface MCPStructuredPromptIntent {
  name: 'prompt:structured';
  parameters: {
    prompt: StructuredPrompt;
    modelOptions?: {
      temperature?: number;
      maxTokens?: number;
      model?: string;
    };
  };
}
```

## Context Selection Algorithm

1. **Relevance Scoring**: Score context elements based on:
   - Semantic similarity to query
   - Recency of access/modification
   - Importance (errors > current file > related files)

2. **Context Limiting**: If total context exceeds token limits:
   - Prioritize current file and direct references
   - Truncate less relevant files
   - Summarize terminal output if lengthy
   - Apply sliding window to conversation history

## Template System

```typescript
// Template definition
interface PromptTemplate {
  id: string;
  name: string;
  template: string; // With placeholders: {{userQuery}}, {{currentFile}}, etc.
  defaultOptions?: {
    includeConversationSummary: boolean;
    includeCustomInstructions: boolean;
    // Additional template-specific settings
  };
}

// Template registry
class PromptTemplateRegistry {
  registerTemplate(template: PromptTemplate): void;
  getTemplate(id: string): PromptTemplate | undefined;
  applyTemplate(templateId: string, context: StructuredPrompt): string;
}
```

## Implementation Strategy

### Core Components

1. **ContextCollector**: Gathers relevant context from IDE/environment
2. **ContextPrioritizer**: Scores and selects most relevant context
3. **PromptBuilder**: Constructs the structured prompt
4. **PromptSerializer**: Converts structure to string format for AI
5. **ResponseParser**: Handles AI responses

### Integration Points

- **Reasoning System**: Enhance reasoners with structured context
- **MCP**: Add structured prompt intents to MCP
- **IDE Integration**: Collect file information automatically
- **Memory System**: Link with conversation history

## Serialization Format

The structured prompt is serialized in a format similar to:

```
<custom_instructions>
[Custom instructions content]
</custom_instructions>

<conversation_summary>
[Summary of previous interactions]
</conversation_summary>

<additional_data>
Below are some potentially helpful/relevant pieces of information for figuring out how to respond

<current_file>
Path: src/file.ts
Line: 25
Line Content: `const value = 42;`
</current_file>

<attached_files>
<file_contents>
```path=src/types.ts, lines=1-50
[File content here]
```
</file_contents>
</attached_files>

<linter_errors>
File: src/file.ts
Line 25: Expected semicolon
</linter_errors>
</additional_data>

<user_query>
[User's actual question or request]
</user_query>
```

## Example Usage

```typescript
// Creating a structured prompt
const prompt = new StructuredPromptBuilder()
  .withUserQuery("How do I fix this bug?")
  .withCurrentFile({
    path: "src/core/reasoning/dialogicReasoner.ts",
    line: 25,
    lineContent: " */"
  })
  .withLinterErrors([
    { file: "src/core/reasoning/dialogicReasoner.ts", line: 112, message: "Property 'DIALOGIC' does not exist" }
  ])
  .withConversationSummary("User is implementing a dialogic reasoner")
  .build();

// Serialize the prompt for sending to AI
const serializedPrompt = promptSerializer.serialize(prompt);

// Send to AI via MCP
const response = await mcp.handleIntent({
  name: 'prompt:structured',
  parameters: {
    prompt,
    modelOptions: {
      temperature: 0.7
    }
  }
});
```

## Benefits

1. **Consistency**: Standardized format across the codebase
2. **Contextual Awareness**: AI responses that take into account the user's environment
3. **Separation of Concerns**: Clear distinction between user queries and context
4. **Flexibility**: Extensible framework that can evolve with AI capabilities
5. **Integration**: Works with existing NeuroCore components

## Future Enhancements

- Dynamic context prioritization based on query semantics
- Integration with vector databases for enhanced context retrieval
- Multi-modal context (including diagrams, images, etc.)
- Adaptive templates based on user feedback and interaction patterns
- Context caching to improve performance 