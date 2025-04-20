/**
 * Character Handler
 * 
 * Provides character and trait functionality through the intent system.
 */

import { Intent } from '../intent';
import { IntentHandler, IntentResult } from '../intentHandler';
import { RequestContext } from '../interfaces/plugin';
import { CharacterManager } from '../../core/character/characterManager';
import { TraitApplicationOptions, TraitContext } from '../../types/character';
import { UUID } from '../../types';
import { ValidationError } from '../../core/errors';
import { IntentFilter } from '../intentFilter';

/**
 * Handler for character-related intents
 */
export class CharacterHandler implements IntentHandler {
    private characterManager: CharacterManager;

    constructor(characterManager: CharacterManager) {
        this.characterManager = characterManager;
    }

    /**
     * Get intent filters for this handler
     */
    getIntentFilters(): IntentFilter[] {
        const filters: IntentFilter[] = [];

        // Load character filter
        const loadFilter = new IntentFilter(10);
        loadFilter.addAction('character:load');
        filters.push(loadFilter);

        // Apply traits filter
        const applyFilter = new IntentFilter(10);
        applyFilter.addAction('character:apply');
        filters.push(applyFilter);

        // List characters filter
        const listFilter = new IntentFilter(10);
        listFilter.addAction('character:list');
        filters.push(listFilter);

        return filters;
    }

    /**
     * Handle an intent
     */
    async handleIntent(intent: Intent, context: RequestContext): Promise<IntentResult> {
        try {
            switch (intent.action) {
                case 'character:load':
                    return this.handleLoadCharacter(intent, context);
                case 'character:get':
                    return this.handleGetCharacter(intent, context);
                case 'character:apply':
                    return this.handleApplyTraits(intent, context);
                case 'character:update':
                    return this.handleUpdateCharacter(intent, context);
                default:
                    return {
                        success: false,
                        error: `Unsupported intent: ${intent.action}`
                    };
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Handle loading a character from a file
     */
    private async handleLoadCharacter(intent: Intent, context: RequestContext): Promise<IntentResult> {
        const { filePath, characterData } = intent.data || {};

        try {
            let character;

            // Load from file or direct data
            if (filePath) {
                character = await this.characterManager.loadCharacterFromFile(filePath);
            } else if (characterData) {
                character = await this.characterManager.createCharacter(characterData);
            } else {
                throw new ValidationError('Either filePath or characterData must be provided');
            }

            return {
                success: true,
                data: {
                    characterId: character.id,
                    name: character.name,
                    traitCount: character.traits.length
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Handle getting character details
     */
    private async handleGetCharacter(intent: Intent, context: RequestContext): Promise<IntentResult> {
        const { characterId } = intent.data || {};

        if (!characterId) {
            return {
                success: false,
                error: 'Character ID is required'
            };
        }

        try {
            const character = await this.characterManager.getCharacter(characterId as UUID);

            if (!character) {
                return {
                    success: false,
                    error: `Character not found: ${characterId}`
                };
            }

            return {
                success: true,
                data: {
                    character
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Handle applying character traits to content
     */
    private async handleApplyTraits(intent: Intent, context: RequestContext): Promise<IntentResult> {
        const { characterId, content, options = {}, sessionId } = intent.data || {};

        if (!characterId) {
            return {
                success: false,
                error: 'Character ID is required'
            };
        }

        if (!content) {
            return {
                success: false,
                error: 'Content is required'
            };
        }

        try {
            // Prepare application options
            const applicationOptions: TraitApplicationOptions = {
                context: options.context || TraitContext.CHAT,
                traitTypes: options.traitTypes,
                priorityTraits: options.priorityTraits,
                adaptToDynamics: options.adaptToDynamics !== false
            };

            // Apply traits
            const result = await this.characterManager.applyTraits(
                characterId as UUID,
                content,
                applicationOptions,
                sessionId as UUID
            );

            return {
                success: true,
                data: {
                    content: result.content,
                    appliedTraitCount: result.appliedTraits.length,
                    processingTime: result.metrics?.processingTime
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Handle updating character state
     */
    private async handleUpdateCharacter(intent: Intent, context: RequestContext): Promise<IntentResult> {
        const { characterId, updates, sessionId } = intent.data || {};

        if (!characterId) {
            return {
                success: false,
                error: 'Character ID is required'
            };
        }

        try {
            // If session ID is provided, update state instead of character
            if (sessionId) {
                const state = await this.characterManager.updateCharacterState(
                    characterId as UUID,
                    sessionId as UUID,
                    updates || {}
                );

                return {
                    success: true,
                    data: {
                        characterId,
                        sessionId,
                        state
                    }
                };
            } else {
                // Otherwise update character
                if (!updates) {
                    return {
                        success: false,
                        error: 'Updates are required'
                    };
                }

                const character = await this.characterManager.updateCharacter(
                    characterId as UUID,
                    updates
                );

                return {
                    success: true,
                    data: {
                        characterId,
                        name: character.name,
                        updatedAt: character.updatedAt
                    }
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
} 