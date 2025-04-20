/**
 * Character Manager for Neurocore
 * 
 * Manages character definitions, traits, and their application to content.
 */

import { v4 as uuidv4 } from 'uuid';
import { IModelProvider } from '../providers/modelProvider';
import { Character, CharacterState, Trait, TraitApplicationOptions, TraitApplicationResult, TraitContext, TraitType } from '../../types/character';
import { UUID } from '../../types';
import { ValidationError } from '../errors';

/**
 * Options for creating a character manager
 */
export interface CharacterManagerOptions {
    /** Model provider for trait application */
    modelProvider: IModelProvider;
    /** Database for storing characters */
    database?: any;
    /** Logger instance */
    logger?: any;
}

/**
 * Manager for character traits and application
 */
export class CharacterManager {
    private modelProvider: IModelProvider;
    private database: any;
    private logger: any;
    private characters: Map<UUID, Character> = new Map();
    private characterStates: Map<string, CharacterState> = new Map();
    private defaultModel: string = 'gpt-4';

    constructor(options: CharacterManagerOptions) {
        this.modelProvider = options.modelProvider;
        this.database = options.database;
        this.logger = options.logger || console;
    }

    /**
     * Create a new character
     * 
     * @param characterData Character definition
     * @returns The created character
     */
    async createCharacter(characterData: Omit<Character, 'id'>): Promise<Character> {
        try {
            // Validate basic character data
            if (!characterData.name || !characterData.bio || !characterData.traits) {
                throw new ValidationError('Character must have name, bio, and traits');
            }

            // Create character with ID
            const id = uuidv4() as UUID;
            const character: Character = {
                ...characterData,
                id,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Store in memory
            this.characters.set(id, character);

            // Store in database if available
            if (this.database) {
                await this.database.createCharacter(character);
            }

            return character;
        } catch (error) {
            this.logger.error('Failed to create character:', error);
            throw error;
        }
    }

    /**
     * Get a character by ID
     * 
     * @param id Character ID
     * @returns Character or null if not found
     */
    async getCharacter(id: UUID): Promise<Character | null> {
        // Try memory first
        if (this.characters.has(id)) {
            return this.characters.get(id) as Character;
        }

        // Try database
        if (this.database) {
            const character = await this.database.getCharacter(id);
            if (character) {
                this.characters.set(id, character);
                return character;
            }
        }

        return null;
    }

    /**
     * Update character details
     * 
     * @param id Character ID
     * @param updates Updates to apply
     * @returns Updated character
     */
    async updateCharacter(id: UUID, updates: Partial<Character>): Promise<Character> {
        const character = await this.getCharacter(id);
        if (!character) {
            throw new Error(`Character not found: ${id}`);
        }

        // Apply updates
        const updatedCharacter: Character = {
            ...character,
            ...updates,
            id, // Ensure ID remains unchanged
            updatedAt: new Date()
        };

        // Store in memory
        this.characters.set(id, updatedCharacter);

        // Store in database if available
        if (this.database) {
            await this.database.updateCharacter(id, updatedCharacter);
        }

        return updatedCharacter;
    }

    /**
     * Delete a character
     * 
     * @param id Character ID
     * @returns Whether deletion was successful
     */
    async deleteCharacter(id: UUID): Promise<boolean> {
        // Remove from memory
        this.characters.delete(id);

        // Remove from database if available
        if (this.database) {
            return await this.database.deleteCharacter(id);
        }

        return true;
    }

    /**
     * Get or create a character state for a session
     * 
     * @param characterId Character ID
     * @param sessionId Session ID
     * @returns Character state
     */
    async getCharacterState(characterId: UUID, sessionId: UUID): Promise<CharacterState> {
        const stateKey = `${characterId}:${sessionId}`;

        // Check memory first
        if (this.characterStates.has(stateKey)) {
            return this.characterStates.get(stateKey) as CharacterState;
        }

        // Try database
        let state: CharacterState | null = null;
        if (this.database) {
            state = await this.database.getCharacterState(characterId, sessionId);
        }

        // Create if not found
        if (!state) {
            state = {
                characterId,
                sessionId,
                emotionalState: 'neutral',
                contextAwareness: {},
                activeTopics: [],
                interactionCount: 0,
                stateData: {},
                updatedAt: new Date()
            };

            // Store in database if available
            if (this.database) {
                await this.database.createCharacterState(state);
            }
        }

        // Store in memory
        this.characterStates.set(stateKey, state);
        return state;
    }

    /**
     * Update character state
     * 
     * @param characterId Character ID
     * @param sessionId Session ID
     * @param updates Updates to apply
     * @returns Updated state
     */
    async updateCharacterState(
        characterId: UUID,
        sessionId: UUID,
        updates: Partial<CharacterState>
    ): Promise<CharacterState> {
        const stateKey = `${characterId}:${sessionId}`;
        const currentState = await this.getCharacterState(characterId, sessionId);

        // Apply updates
        const updatedState: CharacterState = {
            ...currentState,
            ...updates,
            characterId, // Ensure these remain unchanged
            sessionId,
            updatedAt: new Date()
        };

        // Store in memory
        this.characterStates.set(stateKey, updatedState);

        // Store in database if available
        if (this.database) {
            await this.database.updateCharacterState(characterId, sessionId, updatedState);
        }

        return updatedState;
    }

    /**
     * Apply character traits to content
     * 
     * @param characterId Character ID
     * @param content Content to modify
     * @param options Trait application options
     * @param sessionId Optional session ID for state tracking
     * @returns Modified content with applied traits
     */
    async applyTraits(
        characterId: UUID,
        content: string,
        options: TraitApplicationOptions,
        sessionId?: UUID
    ): Promise<TraitApplicationResult> {
        const startTime = Date.now();

        try {
            // Get character
            const character = await this.getCharacter(characterId);
            if (!character) {
                throw new Error(`Character not found: ${characterId}`);
            }

            // Get character state if session provided
            let state: CharacterState | null = null;
            if (sessionId) {
                state = await this.getCharacterState(characterId, sessionId);
            }

            // Filter traits based on options
            let relevantTraits = character.traits;

            // Filter by context
            if (options.context) {
                relevantTraits = relevantTraits.filter(trait =>
                    !trait.contexts || trait.contexts.includes(options.context)
                );
            }

            // Filter by trait types
            if (options.traitTypes && options.traitTypes.length > 0) {
                relevantTraits = relevantTraits.filter(trait =>
                    options.traitTypes?.includes(trait.type)
                );
            }

            // Sort by priority if specified
            if (options.priorityTraits && options.priorityTraits.length > 0) {
                relevantTraits.sort((a, b) => {
                    const aIsPriority = options.priorityTraits?.includes(a.id) || false;
                    const bIsPriority = options.priorityTraits?.includes(b.id) || false;
                    return (bIsPriority ? 1 : 0) - (aIsPriority ? 1 : 0);
                });
            }

            // Generate content with model
            const system = "You are a role-playing assistant that accurately applies character traits.";
            const prompt = this.generateTraitPrompt(character, relevantTraits, content, options);

            // Call the model to generate the applied text
            const result = await this.modelProvider.generateCompletion({
                messages: [
                    { role: "system", content: system },
                    { role: "user", content: prompt }
                ],
                model: this.defaultModel
            });

            // Extract content from completion
            const generatedContent = typeof result.content === 'string'
                ? result.content
                : result.content.map(c => c.text || '').join('');

            // Update state if available
            if (state && sessionId) {
                state.interactionCount = (state.interactionCount || 0) + 1;
                state.updatedAt = new Date();

                // Update other state properties based on interaction
                // This would typically involve analyzing the content and updating
                // emotional state, active topics, etc.

                await this.updateCharacterState(characterId, sessionId, state);
            }

            // Return result
            return {
                content: generatedContent,
                appliedTraits: relevantTraits,
                characterState: state || {
                    characterId,
                    sessionId: '' as UUID,
                    updatedAt: new Date()
                },
                metrics: {
                    processingTime: Date.now() - startTime
                }
            };
        } catch (error) {
            this.logger.error('Failed to apply traits:', error);
            throw error;
        }
    }

    /**
     * Load a character from a file
     * 
     * @param filePath Path to character file
     * @returns Loaded character
     */
    async loadCharacterFromFile(filePath: string): Promise<Character> {
        try {
            // In a real implementation, this would read from the file system
            const fs = require('fs');
            const rawData = fs.readFileSync(filePath, 'utf8');
            const characterData = JSON.parse(rawData);

            // Convert to proper format if needed
            const character = this.convertToCharacter(characterData);

            // Store the character
            return await this.createCharacter(character);
        } catch (error) {
            this.logger.error(`Failed to load character from file ${filePath}:`, error);
            throw error;
        }
    }

    /**
     * Convert from external format to Character
     */
    private convertToCharacter(data: any): Omit<Character, 'id'> {
        // Basic validation
        if (!data.name) {
            throw new ValidationError('Character must have a name');
        }

        // Convert traits
        const traits: Trait[] = [];

        // Add personality traits from adjectives
        if (data.adjectives && Array.isArray(data.adjectives)) {
            data.adjectives.forEach((adj: string, index: number) => {
                traits.push({
                    id: `personality_${index}`,
                    name: adj,
                    type: TraitType.PERSONALITY,
                    value: adj,
                    intensity: 0.8, // Default high intensity
                    contexts: [TraitContext.CHAT, TraitContext.POST] // Apply to all contexts
                });
            });
        }

        // Add style traits
        if (data.style) {
            if (data.style.all && Array.isArray(data.style.all)) {
                data.style.all.forEach((style: string, index: number) => {
                    traits.push({
                        id: `style_all_${index}`,
                        name: style,
                        type: TraitType.STYLE,
                        value: style,
                        contexts: [TraitContext.CHAT, TraitContext.POST]
                    });
                });
            }

            if (data.style.chat && Array.isArray(data.style.chat)) {
                data.style.chat.forEach((style: string, index: number) => {
                    traits.push({
                        id: `style_chat_${index}`,
                        name: style,
                        type: TraitType.STYLE,
                        value: style,
                        contexts: [TraitContext.CHAT]
                    });
                });
            }

            if (data.style.post && Array.isArray(data.style.post)) {
                data.style.post.forEach((style: string, index: number) => {
                    traits.push({
                        id: `style_post_${index}`,
                        name: style,
                        type: TraitType.STYLE,
                        value: style,
                        contexts: [TraitContext.POST]
                    });
                });
            }
        }

        // Convert examples
        const examples = [];
        if (data.messageExamples && Array.isArray(data.messageExamples)) {
            for (const ex of data.messageExamples) {
                if (Array.isArray(ex) && ex.length >= 2) {
                    examples.push({
                        context: TraitContext.CHAT,
                        input: ex[0].content?.text || '',
                        output: ex[1].content?.text || ''
                    });
                }
            }
        }

        // Build character
        return {
            name: data.name,
            bio: Array.isArray(data.bio) ? data.bio : [data.bio || ''],
            traits,
            lore: Array.isArray(data.lore) ? data.lore : [],
            examples,
            topics: Array.isArray(data.topics) ? data.topics : [],
            settings: data.settings || {}
        };
    }

    /**
     * Generate a prompt that incorporates character traits
     */
    private generateTraitPrompt(
        character: Character,
        traits: Trait[],
        content: string,
        options: TraitApplicationOptions
    ): string {
        const contextType = options.context || TraitContext.CHAT;

        // Create a structured prompt
        let prompt = `You are ${character.name}, an AI assistant with the following traits:\n\n`;

        // Add personality description
        prompt += "# Personality\n";
        const personalityTraits = traits.filter(t => t.type === TraitType.PERSONALITY);
        if (personalityTraits.length > 0) {
            prompt += personalityTraits.map(t => `- ${t.value}`).join("\n");
        } else {
            prompt += character.bio.join("\n");
        }
        prompt += "\n\n";

        // Add style guidelines for this context
        prompt += `# Communication Style (${contextType})\n`;
        const styleTraits = traits.filter(t =>
            t.type === TraitType.STYLE &&
            (!t.contexts || t.contexts.includes(options.context))
        );
        if (styleTraits.length > 0) {
            prompt += styleTraits.map(t => `- ${t.value}`).join("\n");
        }
        prompt += "\n\n";

        // Add relevant background if available
        const backgroundTraits = traits.filter(t => t.type === TraitType.BACKGROUND);
        if (backgroundTraits.length > 0) {
            prompt += "# Background\n";
            prompt += backgroundTraits.map(t => `- ${t.value}`).join("\n");
            prompt += "\n\n";
        }

        // Add examples relevant to this context
        const contextExamples = character.examples?.filter(e => e.context === options.context) || [];
        if (contextExamples.length > 0) {
            prompt += "# Example Interactions\n";
            for (const example of contextExamples.slice(0, 2)) { // Limit to 2 examples
                prompt += `User: ${example.input}\nYou: ${example.output}\n\n`;
            }
        }

        // Task description based on context
        prompt += "# Task\n";
        switch (contextType) {
            case TraitContext.CHAT:
                prompt += `Respond to the following message in a way that reflects your personality and style:\n\n${content}`;
                break;
            case TraitContext.POST:
                prompt += `Create a social media post about the following topic in your unique style:\n\n${content}`;
                break;
            case TraitContext.REFLECTION:
                prompt += `Reflect on the following information in your voice:\n\n${content}`;
                break;
            case TraitContext.ANALYSIS:
                prompt += `Analyze the following content in your characteristic way:\n\n${content}`;
                break;
            default:
                prompt += `Respond to the following in your voice:\n\n${content}`;
        }

        return prompt;
    }
} 