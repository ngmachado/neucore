import { Template } from '../../core/templates';

/**
 * Default templates for the Alfafrens plugin
 */
export const ALFAFRENS_TEMPLATES: Template[] = [
    // Standard response template
    {
        id: 'alfafrens:response:standard',
        category: 'response',
        content: `{{message.content}}`,
        metadata: {
            usage: 'standard',
            priority: 100,
            pluginId: 'alfafrens-plugin',
            description: 'Standard response template'
        }
    },

    // Greeting response template
    {
        id: 'alfafrens:response:greeting',
        category: 'response',
        content: `Hello {{message.username}}! {{message.content}}`,
        metadata: {
            usage: 'greeting',
            priority: 100,
            tags: ['greeting'],
            pluginId: 'alfafrens-plugin',
            description: 'Template for greeting responses'
        }
    },

    // Question response template
    {
        id: 'alfafrens:response:question',
        category: 'response',
        content: `{{message.content}}`,
        metadata: {
            usage: 'question',
            priority: 100,
            tags: ['question'],
            pluginId: 'alfafrens-plugin',
            description: 'Template for question responses'
        }
    },

    // Complex response template with sections
    {
        id: 'alfafrens:response:complex',
        category: 'response',
        content: `{{message.content}}`,
        metadata: {
            usage: 'complex',
            priority: 100,
            tags: ['complex'],
            pluginId: 'alfafrens-plugin',
            description: 'Template for complex responses with sections'
        }
    },

    // Error response template
    {
        id: 'alfafrens:response:error',
        category: 'response',
        content: `I'm sorry, I wasn't able to process your request: "{{message.raw}}". Please try again or rephrase your question.`,
        metadata: {
            usage: 'error',
            priority: 100,
            tags: ['error'],
            pluginId: 'alfafrens-plugin',
            description: 'Template for error responses'
        }
    },

    // Thinking response template
    {
        id: 'alfafrens:response:thinking',
        category: 'response',
        content: `Let me think about that... {{message.content}}`,
        metadata: {
            usage: 'thinking',
            priority: 100,
            tags: ['thinking'],
            pluginId: 'alfafrens-plugin',
            description: 'Template for responses that involve complex reasoning'
        }
    },

    // Opinion response template
    {
        id: 'alfafrens:response:opinion',
        category: 'response',
        content: `In my view, {{message.content}}`,
        metadata: {
            usage: 'opinion',
            priority: 100,
            tags: ['opinion'],
            pluginId: 'alfafrens-plugin',
            description: 'Template for opinion-based responses'
        }
    },

    // Informal response template
    {
        id: 'alfafrens:response:informal',
        category: 'response',
        content: `{{message.content}}`,
        metadata: {
            usage: 'informal',
            priority: 100,
            tags: ['informal'],
            pluginId: 'alfafrens-plugin',
            description: 'Template for informal conversational responses'
        }
    }
]; 