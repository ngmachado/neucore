# AlfaFrens Client for ElizaOS

A flexible API client for integrating ElizaOS with AlfaFrens channels. This package handles message communication, content creation, and AI-powered interactions with the AlfaFrens platform.

## Overview

This client enables integration with AlfaFrens social channels, allowing AI characters to:

- Send and receive messages in AlfaFrens channels
- Create original posts on a customizable schedule
- Respond intelligently to user messages
- Access channel-specific content and history
- Leverage knowledge bases for accurate responses

The package is designed for flexibility and can be configured to power various AI personalities, from helpful assistants to distinctive characters like SpikyBoi.

## Features

- **Core Client**: API integration with AlfaFrens platform
- **Messaging**: Send, receive, and respond to channel messages
- **Automated Posting**: Schedule regular content posts 
- **AI Integration**: Connect AI models to power interactions
- **Knowledge Base**: FAQ-driven RAG system for accurate information
- **ElizaOS Integration**: Deployment in the ElizaOS ecosystem
- **Flexible Configuration**: Adjustable response patterns and personality settings

## Installation in ElizaOS

This plugin is designed to work with ElizaOS. To set it up without sharing your entire ElizaOS codebase:

1. **For ElizaOS users**: Install the plugin directly to your ElizaOS installation:
   ```bash
   # Navigate to your ElizaOS installation
   cd path/to/elizaos
   
   # Install directly from this repository
   pnpm install --save @superfluid-finance/client-alfafrens
   
   # Or copy the package to your local packages directory
   cp -r /path/to/client-alfafrens packages/
   ```

2. **Update your ElizaOS workspace** (if using the copy method):
   Make sure the workspace is properly configured in your ElizaOS root:
   ```json
   "workspaces": [
     "packages/*"
   ]
   ```

3. **Configure your character**:
   Add the plugin to your character file:
   ```json
   {
     "plugins": ["@elizaos/client-alfafrens"],
     "settings": {
       "ALFAFRENS_API_KEY": "your-api-key",
       "ALFAFRENS_CHANNEL_ID": "your-channel-id"
     }
   }
   ```

4. **Build and start**:
   ```bash
   # From ElizaOS root
   pnpm build
   pnpm start --character=characters/your-character.json
   ```

If you encounter `ERR_PNPM_WORKSPACE_PKG_NOT_FOUND`, ensure the package is correctly installed in your ElizaOS workspace.

## Configuration

The client requires the following configuration in your character file:

```json
{
  "plugins": ["@elizaos/client-alfafrens"],
  "settings": {
    "ALFAFRENS_API_KEY": "your-api-key",
    "ALFAFRENS_CHANNEL_ID": "your-channel-id",
    "ALFAFRENS_USER_ID": "your-user-id",
    "ALFAFRENS_USERNAME": "Bot Name",
    "ALFAFRENS_BASE_URL": "https://alfafrens.com/api"
  }
}
```

### AI Template Configuration

You can customize the AI's behavior through these additional settings:

```json
{
  "settings": {
    "ALFAFRENS_POST_TEMPLATE": "Custom template for generating posts with {{character.name}}, {{character.adjectives}}, and {{character.topics}} placeholders",
    "ALFAFRENS_RESPONSE_TEMPLATE": "Custom template for generating responses",
    "ALFAFRENS_EVALUATION_TEMPLATE": "Custom template for evaluating whether to respond",
    "ALFAFRENS_MODEL_CLASS": "MEDIUM", 
    "ALFAFRENS_POST_MODEL_CLASS": "SMALL", 
    "ALFAFRENS_RESPONSE_MODEL_CLASS": "MEDIUM",
    "ALFAFRENS_EVALUATION_MODEL_CLASS": "SMALL",
    "ALFAFRENS_POST_INTERVAL_SECONDS": 3600,
    "ALFAFRENS_POLL_INTERVAL_SECONDS": 30,
    "ALFAFRENS_MAX_HISTORY_LENGTH": 20,
    "ALFAFRENS_HISTORY_COUNT": 5
  }
}
```

## Basic Usage

The client can be used to send and receive messages from AlfaFrens:

```typescript
import { AlfaFrensClient } from "@elizaos/client-alfafrens";

// Start the client (in your plugin or application)
const client = await AlfaFrensClient.start(runtime);

// Send a message
await client.sendMessage({
  content: "Hello, world!",
  roomId: "your-room-id"
});

// Get messages
const messages = await client.getMessages({
  roomId: "your-room-id",
  since: Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
  includeReplies: true,
  includeReactions: true
});
```

## Advanced Usage with AI Extensions

The client includes optional AI extensions for more advanced use cases:

```typescript
import { AlfaFrensClient, Extensions } from "@elizaos/client-alfafrens";

// Start the client
const client = await AlfaFrensClient.start(runtime);

// Add AI-powered automatic posting
const aiPost = new Extensions.AlfaFrensAIPost(client, runtime, {
  // Optional: Override configuration from character file
  postTemplate: "Custom template",
  modelClass: ModelClass.MEDIUM
});
await aiPost.start(); // Uses interval from character file or default (3600s)

// Add AI-powered interaction
const aiInteraction = new Extensions.AlfaFrensAIInteraction(client, runtime, {
  // Optional: Override configuration from character file
  responseTemplate: "Custom template",
  modelClass: ModelClass.SMALL
});
await aiInteraction.start(); // Uses interval from character file or default (30s)

// Register ElizaOS actions
Extensions.registerAlfaFrensActions(client, runtime, {
  // Optional: Override configuration from character file
  postTemplate: "Custom template",
  responseTemplate: "Custom template"
});
```

## Using with Other Plugins

AlfaFrens client can be combined with other ElizaOS plugins:

```typescript
// Example: Using AlfaFrens with WebSearch plugin
import { WebSearchClient } from "@elizaos/plugin-web-search";
import { AlfaFrensClient } from "@elizaos/client-alfafrens";

// In your plugin's setup
const webSearch = await WebSearchClient.start(runtime);
const alfaFrens = await AlfaFrensClient.start(runtime);

// Search and post results
const results = await webSearch.search("latest tech news");
await alfaFrens.sendMessage({
  content: `Here are the latest tech news: ${results.summary}`,
  roomId: "your-room-id"
});
```

## Template Placeholders

When creating custom templates, you can use these placeholders:

- `{{character.name}}` - The character's name
- `{{character.adjectives}}` - List of character adjectives
- `{{character.topics}}` - List of character's topics
- `{{message.content}}` - The content of the message (for responses/evaluation)
- `{{message.sender}}` - The sender's username (for responses/evaluation)
- `{{messageHistory}}` - Conversation history (for responses)
- `{{websearch}}` - Web search results (requires web-search plugin)
- `{{knowledge}}` - Relevant information from knowledge base documents

## API Reference

### Core Client

- `AlfaFrensClient.start(runtime)`: Starts the client
- `client.sendMessage({ content, roomId, inReplyTo? })`: Sends a message
- `client.createPost({ content, roomId })`: Creates a post
- `client.getMessages({ roomId, since?, until?, includeReplies?, includeReactions? })`: Gets messages

### AI Extensions

- `Extensions.AlfaFrensAIPost`: AI-powered post generator
  - `new AlfaFrensAIPost(client, runtime, options?)`: Creates a new instance
  - `aiPost.start(intervalSeconds?)`: Starts automatic posting
  - `aiPost.stop()`: Stops automatic posting
  - `aiPost.createPost(customContent?)`: Creates a post

- `Extensions.AlfaFrensAIInteraction`: AI-powered interaction manager
  - `new AlfaFrensAIInteraction(client, runtime, options?)`: Creates a new instance
  - `aiInteraction.start(intervalSeconds?)`: Starts automatic interactions
  - `aiInteraction.stop()`: Stops automatic interactions

- `Extensions.registerAlfaFrensActions(client, runtime, options?)`: Registers ElizaOS actions

## Quick Start

To build and start the client with a specific character:

```bash
# Navigate to the project root
cd /path/to/elizaos

# Build the packages
pnpm build

# Start with a specific character
pnpm start --character=characters/alfafrens-bot.character.json

# Start with a specific character and environment variables
ALFAFRENS_API_KEY=your_api_key ALFAFRENS_CHANNEL_ID=your_channel_id pnpm start --character=characters/spikyboi.json
```

For development with hot-reloading:

```bash
# In the client-alfafrens directory
cd packages/client-alfafrens

# Start in development mode
pnpm dev

# Watch for changes and automatically update
pnpm watch
``` 

## License

MIT License
