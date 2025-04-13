import { ITemplateDataProvider } from '../../core/templates/dataProvider';

/**
 * Data provider for bot-related template variables
 */
export class BotDataProvider implements ITemplateDataProvider {
    private botConfig: any;
    private characterId: string | null = null;
    private characterTraits: Record<string, any> = {};

    /**
     * Initialize the bot data provider
     * @param config Bot configuration
     */
    constructor(config: any) {
        this.botConfig = config || {};
    }

    /**
     * Set the active character ID and traits
     * @param characterId Character ID
     * @param traits Character traits
     */
    public setCharacter(characterId: string, traits: Record<string, any>): void {
        this.characterId = characterId;
        this.characterTraits = traits || {};
    }

    /**
     * Get the namespace for this provider
     */
    public getNamespace(): string {
        return 'bot';
    }

    /**
     * Get priority for this provider
     */
    public getPriority(): number {
        return 90; // High priority but lower than message data
    }

    /**
     * Extract bot-related variables from context
     */
    public getVariables(context: any): Record<string, any> {
        // Extract basic bot info from config
        const variables: Record<string, any> = {
            name: this.botConfig.name || this.botConfig.username || 'AlfafrensBot',
            userId: this.botConfig.userId || '',
            username: this.botConfig.username || 'AlfafrensBot',
            characterId: this.characterId || '',
            hasCharacter: !!this.characterId,
        };

        // Add character traits if available
        if (this.characterTraits) {
            variables.traits = { ...this.characterTraits };

            // Add specific traits directly in the bot namespace
            if (this.characterTraits.personality) {
                variables.personality = this.characterTraits.personality;
            }

            if (this.characterTraits.voice) {
                variables.voice = this.characterTraits.voice;
            }

            if (this.characterTraits.knowledge) {
                variables.knowledge = this.characterTraits.knowledge;
            }
        }

        return variables;
    }
} 