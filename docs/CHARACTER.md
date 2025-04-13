# Character Traits System

> **Navigation**: [Back to Main README](../README.md)

The Character Traits System allows AI applications to maintain consistent character personalities, styles, and behaviors across interactions. This system enables plugins to leverage shared character definitions while implementing specific behavior.

## Overview

The Character Traits System provides:

1. **Character Definitions**: Structured representation of AI personalities
2. **Trait Management**: Organization and application of personality traits
3. **Intent-Based Interface**: Standardized access through the MCP intent system
4. **State Tracking**: Maintaining character state across interactions

## Key Components

### Character

A character represents a complete AI personality with:
- **Basic Information**: Name, bio, creation date
- **Traits**: Personality attributes, communication styles, preferences
- **Lore**: Backstory and contextual information
- **Examples**: Sample interactions demonstrating tone and style
- **Settings**: Configuration parameters for behavior

### Traits

Individual aspects of a character's personality:
- **Personality Traits**: Core attributes (helpful, friendly, analytical)
- **Style Traits**: Communication preferences (formal, casual, technical)
- **Knowledge Traits**: Areas of expertise or focus
- **Background Traits**: Character history and context
- **Preference Traits**: Likes, dislikes, and tendencies

### Application Contexts

Traits can be applied in different contexts:
- **Chat**: Direct conversational interactions
- **Post**: Social media or broadcast content
- **Reflection**: Internal processing and decision making
- **Analysis**: Evaluation of information

## Usage

### Creating a Character

Characters can be defined programmatically or loaded from JSON files:

```typescript
// Create a character programmatically
const character = await characterManager.createCharacter({
  name: "HelperBot",
  bio: ["Friendly AI assistant", "Focuses on being helpful and clear"],
  traits: [
    {
      id: "friendly",
      name: "Friendly",
      type: TraitType.PERSONALITY,
      value: "warm and approachable",
      contexts: [TraitContext.CHAT, TraitContext.POST]
    },
    {
      id: "clear",
      name: "Clear",
      type: TraitType.STYLE,
      value: "explains clearly without jargon",
      contexts: [TraitContext.CHAT]
    }
  ]
});

// Or load from a file
const character = await characterManager.loadCharacterFromFile("./characters/helper.json");
```

### Using Character Intents

```typescript
// Load a character definition
const loadIntent = new Intent('character:load', {
  filePath: './characters/assistant.json'
});
const loadResult = await mcp.executeIntent(loadIntent);
const characterId = loadResult.data.characterId;

// Apply character traits to content
const applyIntent = new Intent('character:apply', {
  characterId,
  content: "Here's the information you requested about quantum computing.",
  options: {
    context: TraitContext.CHAT,
    traitTypes: [TraitType.PERSONALITY, TraitType.STYLE]
  },
  sessionId: "session123"
});
const result = await mcp.executeIntent(applyIntent);
console.log("Character response:", result.data.content);
```

## Character File Format

Character definitions are stored in JSON files:

```json
{
  "name": "ExampleBot",
  "bio": [
    "Helpful and friendly AI assistant",
    "Explains complex topics simply"
  ],
  "lore": [
    "Created as a demonstration of character capabilities"
  ],
  "messageExamples": [
    [
      {
        "user": "User123",
        "content": {
          "text": "Can you explain quantum computing?"
        }
      },
      {
        "user": "ExampleBot",
        "content": {
          "text": "Quantum computing uses quantum bits that can be both 0 and 1 simultaneously, enabling certain calculations to be done much faster than traditional computers."
        }
      }
    ]
  ],
  "postExamples": [
    "Did you know that learning something new creates new neural connections in your brain? Keep growing!"
  ],
  "topics": [
    "education",
    "technology",
    "science"
  ],
  "adjectives": [
    "helpful",
    "friendly",
    "clear"
  ],
  "style": {
    "all": [
      "Clear",
      "Concise"
    ],
    "chat": [
      "Conversational",
      "Helpful"
    ],
    "post": [
      "Informative",
      "Accessible"
    ]
  },
  "settings": {
    "temperature": 0.7
  }
}
```

## Supported Intents

| Intent | Description | Data Parameters |
|--------|-------------|----------------|
| `character:load` | Load a character from file or data | `filePath` or `characterData` |
| `character:get` | Get character details | `characterId` |
| `character:apply` | Apply traits to content | `characterId`, `content`, `options`, `sessionId` |
| `character:update` | Update character or state | `characterId`, `updates`, `sessionId` |

## Implementation for Plugins

Plugins that want to use the character system should:

1. Load character definitions at initialization
2. Send `character:apply` intents when generating content
3. Update character state after interactions
4. Include session IDs to maintain consistency

## Advanced Features

- **Dynamic Adaptation**: Characters can adapt behavior based on conversation context
- **Emotional State**: Track and evolve emotional responses over time
- **Topic Awareness**: Recognize and adapt to conversation topics
- **Contextual Style**: Apply different traits based on interaction context 