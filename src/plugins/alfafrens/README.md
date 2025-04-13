# Alfafrens Template Integration

This directory contains the template-related components for the Alfafrens plugin, which enable dynamic, formatted responses with variable substitution.

## Components

### Data Providers

- **MessageDataProvider**: Provides message-related variables (e.g., `{{message.username}}`, `{{message.content}}`)
- **BotDataProvider**: Provides bot-related variables (e.g., `{{bot.name}}`, `{{bot.personality}}`)

### Templates

- **ALFAFRENS_TEMPLATES**: Collection of pre-defined templates for various response types:
  - Standard responses
  - Greeting responses
  - Question responses
  - Complex responses
  - Error responses
  - And more

### Formatting

- **ResponseFormatter**: Utility for formatting raw AI responses:
  - Removes artificial signatures
  - Breaks long paragraphs for readability
  - Formats lists and structured content
  - Handles spacing based on content length

### Integration

- **TemplateIntegration**: Main integration class that:
  - Registers data providers
  - Registers templates
  - Provides methods for formatting responses

## Usage

### Initializing the Template Integration

```typescript
// In the Alfafrens plugin
import { TemplateIntegration } from './alfafrens/templateIntegration';

// Create the integration
this.templateIntegration = new TemplateIntegration({
  mcp: this.mcp,
  logger: this.logger,
  botConfig: this.config
});

// Initialize (registers providers and templates)
await this.templateIntegration.initialize();

// Set character information
this.templateIntegration.setCharacter(this.characterId, characterTraits);
```

### Formatting Responses

```typescript
// Format a response to a message
const formattedResponse = await this.templateIntegration.formatResponse(
  message,          // The message being responded to
  rawAiResponse,    // The raw AI-generated response
  'standard'        // Template usage hint (optional)
);

// Send the formatted response
await this.api.replyMessage(formattedResponse, message.id);
```

## Template Types

The Alfafrens plugin includes several template types:

- **standard**: Basic response template
- **greeting**: For greeting messages
- **question**: For answering questions
- **complex**: For complex responses with sections
- **error**: For error messages
- **thinking**: For responses requiring reasoning
- **opinion**: For opinion-based responses
- **informal**: For casual conversation

## Available Variables

### Message Variables

- `{{message.id}}`: Message ID
- `{{message.content}}`: Message content
- `{{message.username}}`: Sender's username
- `{{message.time}}`: Formatted message time
- `{{message.date}}`: Formatted message date
- `{{message.isReply}}`: Whether it's a reply

### Bot Variables

- `{{bot.name}}`: Bot name
- `{{bot.username}}`: Bot username
- `{{bot.personality}}`: Bot personality trait
- `{{bot.voice}}`: Bot voice characteristic
- `{{bot.knowledge}}`: Bot knowledge area

### System Variables

- `{{system.date}}`: Current date
- `{{system.time}}`: Current time
- `{{system.timestamp}}`: ISO timestamp

## Extending

### Adding New Templates

Add new templates to the `templates.ts` file:

```typescript
{
  id: 'alfafrens:response:custom',
  category: 'response',
  content: `Custom template with {{message.username}} and {{bot.name}}`,
  metadata: {
    usage: 'custom',
    priority: 100,
    tags: ['custom'],
    pluginId: 'alfafrens-plugin'
  }
}
```

### Custom Variable Providers

Create a new provider by implementing the `ITemplateDataProvider` interface:

```typescript
import { ITemplateDataProvider } from '../../core/templates/dataProvider';

export class CustomProvider implements ITemplateDataProvider {
  getNamespace() { return 'custom'; }
  getPriority() { return 75; }
  getVariables(context: any) {
    return {
      // Custom variables
    };
  }
}
```

Then register it with the template system:

```typescript
const intent = new Intent('template:provider:register', {
  provider: new CustomProvider()
});
await this.mcp.executeIntent(intent);
``` 