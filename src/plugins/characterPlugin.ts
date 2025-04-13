import { IPlugin, PluginResult, RequestContext } from '../mcp/interfaces/plugin';
import { Intent } from '../mcp/intent';
import { UUID } from '../types';
import { ProviderFactory } from '../core/providers';
import { IModelProvider } from '../core/providers/modelProvider';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Simple character plugin to handle character-related intents
 */
export class CharacterPlugin implements IPlugin {
    private initialized: boolean = false;
    private logger: any;
    private characterCache: Map<string, any> = new Map();
    private modelProvider: IModelProvider | null = null;
    private charactersDir: string = '';
    private providerFactory: ProviderFactory | null = null;

    constructor(options: {
        logger: any,
        providerFactory?: ProviderFactory,
        config?: {
            charactersDir?: string
        }
    }) {
        this.logger = options.logger;

        // Set up characters directory
        this.charactersDir = options.config?.charactersDir ||
            path.join(process.cwd(), 'data', 'characters');

        // Set up model provider if available
        if (options.providerFactory) {
            this.providerFactory = options.providerFactory;
        }
    }

    /**
     * Get the ID of this plugin
     */
    public getId(): UUID {
        return 'character-plugin';
    }

    /**
     * Get the name of this plugin
     */
    public getName(): string {
        return 'Character Plugin';
    }

    /**
     * Check if this plugin can handle an intent
     */
    public canHandle(intent: Intent): boolean {
        return intent.action.startsWith('character:');
    }

    /**
     * Get the list of intents this plugin supports
     */
    public supportedIntents(): string[] {
        return [
            'character:load',
            'character:apply'
        ];
    }

    /**
     * Initialize the plugin
     */
    public async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        this.logger.info('Initializing CharacterPlugin');

        // Ensure the characters directory exists
        if (!fs.existsSync(this.charactersDir)) {
            try {
                fs.mkdirSync(this.charactersDir, { recursive: true });
                this.logger.info(`Created characters directory at ${this.charactersDir}`);
            } catch (error) {
                this.logger.error(`Failed to create characters directory: ${error}`);
            }
        }

        // Try to initialize model provider if a factory was provided
        if (!this.modelProvider && this.providerFactory) {
            try {
                this.modelProvider = this.providerFactory.getProvider();
                this.logger.info(`CharacterPlugin initialized with AI provider: ${this.modelProvider.constructor.name}`);
            } catch (error) {
                this.logger.warn(`Could not initialize model provider: ${error instanceof Error ? error.message : String(error)}`);
                this.logger.info('CharacterPlugin will use rule-based character trait application');
                this.modelProvider = null;
            }
        } else if (!this.modelProvider) {
            this.logger.info('No model provider available for CharacterPlugin; will use rule-based character trait application');
        }

        this.initialized = true;
    }

    /**
     * Shutdown the plugin
     */
    public async shutdown(): Promise<void> {
        this.logger.info('Shutting down CharacterPlugin');
        this.initialized = false;
    }

    /**
     * Execute an intent
     */
    public async execute(intent: Intent, context: RequestContext): Promise<PluginResult> {
        if (!this.initialized) {
            return {
                success: false,
                error: 'Plugin not initialized'
            };
        }

        try {
            switch (intent.action) {
                case 'character:load':
                    return this.handleLoadCharacter(intent.data, context);
                case 'character:apply':
                    return this.handleApplyCharacter(intent.data, context);
                default:
                    return {
                        success: false,
                        error: `Unsupported intent: ${intent.action}`
                    };
            }
        } catch (error) {
            this.logger.error(`Error executing intent ${intent.action}:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Handle loading a character
     */
    private async handleLoadCharacter(data: any, context: RequestContext): Promise<PluginResult> {
        try {
            const { characterId, filePath } = data || {};

            if (!characterId) {
                return {
                    success: false,
                    error: 'Character ID is required'
                };
            }

            // Check cache first
            if (this.characterCache.has(characterId)) {
                this.logger.info(`Character ${characterId} loaded from cache`);
                return {
                    success: true,
                    data: {
                        characterId: characterId
                    }
                };
            }

            // Try to load character from file
            let character;
            const characterFilePath = filePath || path.join(this.charactersDir, `${characterId}.json`);

            if (fs.existsSync(characterFilePath)) {
                try {
                    const fileContent = fs.readFileSync(characterFilePath, 'utf8');
                    character = JSON.parse(fileContent);
                    this.logger.info(`Character loaded from file: ${characterFilePath}`);
                } catch (fileError) {
                    this.logger.error(`Error reading character file: ${fileError instanceof Error ? fileError.message : String(fileError)}`);
                }
            }

            // If not found, create a default character
            if (!character) {
                this.logger.warn(`Character ${characterId} not found, creating default`);
                character = this.createDefaultCharacter(characterId);
            }

            // Store in cache
            this.characterCache.set(characterId, character);

            this.logger.info(`Character loaded: ${characterId}`);

            return {
                success: true,
                data: {
                    characterId: characterId,
                    character: character
                }
            };
        } catch (error) {
            this.logger.error('Error loading character:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Create a default character
     */
    private createDefaultCharacter(characterId: string): any {
        return {
            id: characterId,
            name: `Character ${characterId}`,
            traits: {
                personality: ['friendly', 'helpful'],
                knowledge: ['AI', 'Technology'],
                style: ['concise', 'informative'],
                voice: ['clear', 'respectful']
            },
            signature: "~ AI Assistant",
            createdAt: new Date().toISOString()
        };
    }

    /**
     * Handle applying a character's traits
     */
    private async handleApplyCharacter(data: any, context: RequestContext): Promise<PluginResult> {
        try {
            const { characterId, content, options } = data || {};

            if (!characterId || !content) {
                return {
                    success: false,
                    error: 'Character ID and content are required'
                };
            }

            // Get character from cache
            const character = this.characterCache.get(characterId);
            if (!character) {
                return {
                    success: false,
                    error: `Character ${characterId} not found, load it first`
                };
            }

            // First, clean any template patterns from the content
            let cleanedContent = this.cleanTemplatePatterns(content);

            // Apply character traits to the content
            const personalizedContent = await this.applyTraitsToContent(cleanedContent, character, options);

            return {
                success: true,
                data: {
                    content: personalizedContent
                }
            };
        } catch (error) {
            this.logger.error('Error applying character:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Clean template patterns from content
     */
    private cleanTemplatePatterns(content: string): string {
        // Remove template phrases
        const templatePatterns = [
            // Solution patterns
            /here is a solution to:.*?based on analysis/gi,
            /I recommend the following approach/gi,
            /based on the information provided/gi,
            /here's (my|the) (solution|approach|answer|response)/gi,
            /^here is the solution:/gi,
            /^the solution is:/gi,
            /^solution:/gi,

            // Response patterns
            /^as requested, here('s| is)/gi,
            /^as you asked/gi,
            /^i('ll| will) (help|assist) (you )?(with that|in responding)/gi,
            /^sure,? (I('ll| can|'d be happy to)|let me)/gi,
            /^certainly[,.]? /gi,

            // Character role patterns
            /\[as .*?\]/gi,
            /^\(as .*?\)/gi,
            /^acting as .*?, /gi,
            /^speaking as .*?, /gi,

            // Meta-commentary
            /^I (think|believe|understand) (that|you're asking)/gi,
            /^let me (think|address|respond|analyze)/gi,
            /^to answer your question/gi,
            /^answering your question/gi
        ];

        let cleanedContent = content;
        templatePatterns.forEach(pattern => {
            cleanedContent = cleanedContent.replace(pattern, '');
        });

        // Handle special cases with more complex replacements
        cleanedContent = cleanedContent
            // Remove "Here's my response to [X]" type phrases
            .replace(/^Here['']s (my|the) (response|answer|reply) (to|for|about) .*?:/gi, '')
            // Remove "In response to your question about X" type phrases
            .replace(/^In response to your (question|inquiry|message) (about|regarding|concerning) .*?[,.]/gi, '')
            // Clean up double punctuation after template removal
            .replace(/([.!?])\s*\1+/g, '$1')
            // Clean up markdown formatting that might be left
            .replace(/^\s*#+\s*/, '');

        // Clean up any weird artifacts from the replacements
        cleanedContent = cleanedContent
            .replace(/\s{2,}/g, ' ')     // Replace multiple spaces with single space
            .replace(/^\s+|\s+$/g, '')   // Trim whitespace
            .replace(/^[.,;:]\s*/g, '')  // Remove leading punctuation
            .replace(/\n{3,}/g, '\n\n'); // Normalize newlines

        return cleanedContent;
    }

    /**
     * Apply character traits to content
     */
    private async applyTraitsToContent(content: string, character: any, options: any): Promise<string> {
        const traitContext = options?.context || 'default';

        // Extract traits that should be applied
        const { personality, voice, style } = character.traits || {};

        // If there's a model provider available, use it for better trait application
        if (this.modelProvider) {
            return this.applyTraitsWithAI(content, character, traitContext);
        }

        // Otherwise fall back to the rule-based implementation
        // Apply personality tone
        let result = content;

        if (personality) {
            // Add character personality hints
            if (personality.includes('friendly')) {
                result = this.addFriendlyTone(result);
            }

            if (personality.includes('professional')) {
                result = this.addProfessionalTone(result);
            }

            if (personality.includes('humorous')) {
                result = this.addHumorousTone(result);
            }
        }

        // Apply voice characteristics if any
        if (voice) {
            result = this.applyVoiceStyle(result, voice);
        }

        // Apply writing style if any
        if (style) {
            result = this.applyWritingStyle(result, style);
        }

        // Add signature if appropriate for the context
        if (traitContext === 'message' || traitContext === 'post') {
            if (character.signature) {
                result += `\n\n${character.signature}`;
            }
        }

        return result;
    }

    /**
     * Apply character traits using AI model
     */
    private async applyTraitsWithAI(content: string, character: any, traitContext: string): Promise<string> {
        if (!this.modelProvider) {
            this.logger.warn('Model provider not available for character traits application, using rule-based approach');
            return this.applyTraitsWithRules(content, character, traitContext);
        }

        // Create traits description
        const traitsDescription = Object.entries(character.traits || {})
            .map(([category, traits]) => {
                if (Array.isArray(traits)) {
                    return `${category}: ${(traits as string[]).join(', ')}`;
                } else if (typeof traits === 'string') {
                    return `${category}: ${traits}`;
                }
                return null;
            })
            .filter(Boolean)
            .join('\n');

        // Create a system prompt that instructs the AI to rewrite content with the character's traits
        const systemPrompt = `You are a writing assistant that rewrites content to match a specific character's traits and style.
        
        CHARACTER TRAITS:
        Name: ${character.name}
        ${traitsDescription}
        
        INSTRUCTIONS:
        - Rewrite the content to reflect the character's personality, voice, and style
        - Preserve ALL of the original meaning and information
        - Don't add new information that wasn't present in the original
        - Use ${traitContext === 'message' ? 'a conversational tone' :
                traitContext === 'post' ? 'a social media style' : 'an appropriate tone'}
        - Be concise and direct
        - Do NOT include any meta-commentary about the rewriting process
        - Do NOT use phrases like "As [character name]" or "In the voice of [character]"
        
        ${character.signature ? `If appropriate, you may add the signature: "${character.signature}"` : ''}`;

        // Create the completion request
        const completionParams = {
            model: 'gpt-3.5-turbo', // Use a faster model for this task
            messages: [
                {
                    role: 'system',
                    content: systemPrompt
                },
                {
                    role: 'user',
                    content: content
                }
            ],
            temperature: 0.7,
            maxTokens: Math.max(300, content.length * 1.5) // Allow some expansion but not too much
        };

        try {
            // Log that we're using the AI for traits application
            this.logger.debug('Applying character traits using AI', {
                characterName: character.name,
                contentLength: content.length,
                traitContext
            });

            // Get the personalized content from the model
            const response = await this.modelProvider.generateCompletion(completionParams);

            // Extract the content from the response
            let personalizedContent = '';

            if (response.content) {
                // Handle string content directly
                if (typeof response.content === 'string') {
                    personalizedContent = response.content;
                }
                // Handle array content (like from OpenAI)
                else if (Array.isArray(response.content)) {
                    personalizedContent = response.content
                        .map(item => item.text || '')
                        .join('');
                }
            }
            // Handle OpenAI-style response where content is in choices[0].message.content
            else if (response.choices && response.choices[0]?.message?.content) {
                personalizedContent = response.choices[0].message.content;
            }

            // If we couldn't extract content, use the original
            if (!personalizedContent || personalizedContent.trim().length === 0) {
                this.logger.warn('AI returned empty content for character trait application, using original');
                return content;
            }

            // If AI returned very small content, return the original
            if (personalizedContent.length < content.length * 0.5) {
                this.logger.warn('AI returned insufficient content for character trait application, using original');
                return content;
            }

            // Clean up any template patterns that might have been added
            personalizedContent = this.cleanTemplatePatterns(personalizedContent);

            this.logger.debug('Successfully applied character traits using AI', {
                characterName: character.name,
                originalLength: content.length,
                personalizedLength: personalizedContent.length
            });

            return personalizedContent;
        } catch (error) {
            this.logger.error('Error applying character traits with AI:', error);
            // Fall back to rule-based approach
            this.logger.info('Falling back to rule-based trait application');
            return this.applyTraitsWithRules(content, character, traitContext);
        }
    }

    /**
     * Apply traits using rule-based approach (fallback)
     */
    private applyTraitsWithRules(content: string, character: any, traitContext: string): string {
        // Extract traits
        const personality = character.traits?.personality || [];
        const voice = character.traits?.voice || [];
        const style = character.traits?.style || [];

        // Apply personality tone
        let result = content;

        if (Array.isArray(personality)) {
            if (personality.includes('friendly')) {
                result = this.addFriendlyTone(result);
            }

            if (personality.includes('professional')) {
                result = this.addProfessionalTone(result);
            }

            if (personality.includes('humorous')) {
                result = this.addHumorousTone(result);
            }
        }

        // Apply voice and style
        if (Array.isArray(voice)) {
            result = this.applyVoiceStyle(result, voice);
        }

        if (Array.isArray(style)) {
            result = this.applyWritingStyle(result, style);
        }

        // Add signature if appropriate
        if ((traitContext === 'message' || traitContext === 'post') && character.signature) {
            result += `\n\n${character.signature}`;
        }

        return result;
    }

    /**
     * Add friendly tone to content
     */
    private addFriendlyTone(content: string): string {
        // Don't modify if already has friendly elements
        if (content.includes('!') || content.includes('😊') || content.includes('Thanks')) {
            return content;
        }

        // Add friendly opening if none exists
        if (!content.startsWith('Hi') && !content.startsWith('Hello')) {
            content = `Hi there! ${content}`;
        }

        // Add friendly closing if none exists
        if (!content.endsWith('!') && !content.includes('Thanks')) {
            content += ' Hope that helps!';
        }

        return content;
    }

    /**
     * Add professional tone to content
     */
    private addProfessionalTone(content: string): string {
        // Replace casual language with more formal alternatives
        return content
            .replace(/yeah/g, 'yes')
            .replace(/nope/g, 'no')
            .replace(/kinda/g, 'somewhat')
            .replace(/gonna/g, 'going to')
            .replace(/wanna/g, 'want to');
    }

    /**
     * Add humorous tone to content
     */
    private addHumorousTone(content: string): string {
        // Don't add humor if content is already likely humorous
        if (content.includes('😄') || content.includes('haha') || content.includes('lol')) {
            return content;
        }

        // Add a light joke or emoji if appropriate
        if (content.length > 100 && !content.includes('😄')) {
            // Add humor at the end of a sentence
            const sentences = content.split(/(?<=[.!?])\s+/);
            if (sentences.length > 1) {
                const randomIndex = Math.floor(Math.random() * (sentences.length - 1));
                const humorOptions = [' 😄', ' (no pun intended)', ' (well, mostly)'];
                const humor = humorOptions[Math.floor(Math.random() * humorOptions.length)];
                sentences[randomIndex] = sentences[randomIndex] + humor;
                content = sentences.join(' ');
            }
        }

        return content;
    }

    /**
     * Apply voice style to content
     */
    private applyVoiceStyle(content: string, voice: any): string {
        if (voice.includes('concise')) {
            // Shorten long-winded explanations
            return content.replace(/(?:in other words|to put it differently|to rephrase).*?(?:[.!?])/gi, '');
        }

        if (voice.includes('detailed')) {
            // Already detailed, no change needed
            return content;
        }

        return content;
    }

    /**
     * Apply writing style to content
     */
    private applyWritingStyle(content: string, style: any): string {
        if (style.includes('bullet-points')) {
            // Convert paragraph to bullet points if it isn't already
            if (!content.includes('• ') && !content.includes('- ')) {
                const sentences = content.split(/(?<=[.!?])\s+/);
                if (sentences.length > 2) {
                    const intro = sentences[0];
                    const points = sentences.slice(1).map(s => `• ${s}`);
                    return `${intro}\n\n${points.join('\n')}`;
                }
            }
        }

        return content;
    }
} 