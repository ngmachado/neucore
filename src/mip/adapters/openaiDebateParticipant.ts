import { v4 as uuidv4 } from 'uuid';
import { DebateParticipant } from '../interfaces/debate/debateParticipant';
import { DebateArgument } from '../types/debate/debateArgument';
import { DebateContext } from '../types/debate/debateContext';

/**
 * Configuration for OpenAI debate participant
 */
interface OpenAIConfig {
    model: string;
    temperature: number;
    maxTokens: number;
    apiKey?: string;
}

/**
 * OpenAI implementation of DebateParticipant
 */
export class OpenAIDebateParticipant implements DebateParticipant {
    private config: OpenAIConfig;
    private role: 'proposer' | 'critic';

    /**
     * Create a new OpenAI debate participant
     * @param role Role in the debate
     * @param config OpenAI configuration
     */
    constructor(
        role: 'proposer' | 'critic',
        config: Partial<OpenAIConfig> = {}
    ) {
        this.role = role;
        this.config = {
            model: config.model || 'gpt-4',
            temperature: config.temperature ?? 0.7,
            maxTokens: config.maxTokens || 1000,
            apiKey: config.apiKey || process.env.OPENAI_API_KEY
        };
    }

    /**
     * Generate initial proposal
     * @param context Debate context
     * @returns List of arguments
     */
    public async propose(context: DebateContext): Promise<DebateArgument[]> {
        const prompt = this.createProposePrompt(context);
        const response = await this.generateResponse(prompt);

        return this.parseArgumentsFromResponse(response);
    }

    /**
     * Critique a proposal
     * @param context Debate context
     * @param proposal Arguments to critique
     * @returns List of critique arguments
     */
    public async critique(
        context: DebateContext,
        proposal: DebateArgument[]
    ): Promise<DebateArgument[]> {
        const prompt = this.createCritiquePrompt(context, proposal);
        const response = await this.generateResponse(prompt);

        return this.parseArgumentsFromResponse(response);
    }

    /**
     * Respond to critiques
     * @param context Debate context
     * @param critiques Arguments to respond to
     * @returns List of response arguments
     */
    public async respond(
        context: DebateContext,
        critiques: DebateArgument[]
    ): Promise<DebateArgument[]> {
        const prompt = this.createResponsePrompt(context, critiques);
        const response = await this.generateResponse(prompt);

        return this.parseArgumentsFromResponse(response);
    }

    /**
     * Generate a conclusion
     * @param context Debate context
     * @returns Conclusion argument
     */
    public async conclude(context: DebateContext): Promise<DebateArgument> {
        const prompt = this.createConcludePrompt(context);
        const response = await this.generateResponse(prompt);

        const args = this.parseArgumentsFromResponse(response);
        return args[0] || {
            id: uuidv4(),
            content: response,
            evidence: [],
            confidence: 0.5,
            metadata: {}
        };
    }

    /**
     * Create prompt for initial proposal
     * @param context Debate context
     * @returns Prompt string
     */
    private createProposePrompt(context: DebateContext): string {
        return `You are the proposer in a debate about the following query:
        
"${context.query}"

${context.background ? `Background information: ${context.background}` : ''}

Your task is to propose a solution to this query. You will be critiqued by another participant.
Provide a clear, well-reasoned solution with supporting evidence. 

Format your response as follows:
ARGUMENT: [Your main argument]
CONFIDENCE: [A number between 0 and 1 representing your confidence]
EVIDENCE:
- [Evidence point 1]
- [Evidence point 2]
- [Add more evidence points as needed]

You can provide multiple arguments by repeating this format.`;
    }

    /**
     * Create prompt for critiquing
     * @param context Debate context
     * @param proposal Arguments to critique
     * @returns Prompt string
     */
    private createCritiquePrompt(
        context: DebateContext,
        proposal: DebateArgument[]
    ): string {
        const proposalText = proposal.map((arg: DebateArgument) =>
            `ARGUMENT: ${arg.content}\nCONFIDENCE: ${arg.confidence}\nEVIDENCE:\n${arg.evidence.map(e => `- ${e}`).join('\n')}`
        ).join('\n\n');

        return `You are the critic in a debate about the following query:
        
"${context.query}"

${context.background ? `Background information: ${context.background}` : ''}

The proposer has made the following arguments:

${proposalText}

Your task is to critique these arguments. Look for flaws in reasoning, missing evidence, 
alternative perspectives, or other weaknesses. Be rigorous but fair.

Format your response as follows:
ARGUMENT: [Your critique]
CONFIDENCE: [A number between 0 and 1 representing your confidence in this critique]
EVIDENCE:
- [Evidence point 1]
- [Evidence point 2]
- [Add more evidence points as needed]

You can provide multiple critiques by repeating this format.`;
    }

    /**
     * Create prompt for responding to critiques
     * @param context Debate context
     * @param critiques Arguments to respond to
     * @returns Prompt string
     */
    private createResponsePrompt(
        context: DebateContext,
        critiques: DebateArgument[]
    ): string {
        const critiquesText = critiques.map((arg: DebateArgument) =>
            `CRITIQUE: ${arg.content}\nCONFIDENCE: ${arg.confidence}\nEVIDENCE:\n${arg.evidence.map(e => `- ${e}`).join('\n')}`
        ).join('\n\n');

        // Get the original proposal
        const lastRound = context.rounds[context.rounds.length - 1];

        return `You are the proposer in a debate about the following query:
        
"${context.query}"

${context.background ? `Background information: ${context.background}` : ''}

The critic has made the following critiques of your arguments:

${critiquesText}

Your task is to respond to these critiques. You can modify your original position, 
provide additional evidence, or defend your original arguments.

Format your response as follows:
ARGUMENT: [Your response]
CONFIDENCE: [A number between 0 and 1 representing your confidence]
EVIDENCE:
- [Evidence point 1]
- [Evidence point 2]
- [Add more evidence points as needed]

You can provide multiple responses by repeating this format.`;
    }

    /**
     * Create prompt for conclusion
     * @param context Debate context
     * @returns Prompt string
     */
    private createConcludePrompt(context: DebateContext): string {
        // Summarize the debate
        const roundsSummary = context.rounds.map((round, index) => {
            const proposerArgs = round.proposerArguments.map(arg =>
                `- Proposer: ${arg.content} (confidence: ${arg.confidence})`
            ).join('\n');

            const criticArgs = round.criticArguments.map(arg =>
                `- Critic: ${arg.content} (confidence: ${arg.confidence})`
            ).join('\n');

            return `Round ${index + 1}:\n${proposerArgs}\n${criticArgs}`;
        }).join('\n\n');

        return `You are the ${this.role} in a debate about the following query:
        
"${context.query}"

${context.background ? `Background information: ${context.background}` : ''}

Summary of the debate so far:

${roundsSummary}

Your task is to provide a final conclusion to the debate from your perspective.
${this.role === 'proposer'
                ? 'As the proposer, summarize your final position, taking into account the critiques received.'
                : 'As the critic, provide your final assessment of the proposed solution.'
            }

Format your response as follows:
ARGUMENT: [Your conclusion]
CONFIDENCE: [A number between 0 and 1 representing your confidence]
EVIDENCE:
- [Evidence point 1]
- [Evidence point 2]
- [Add more evidence points as needed]`;
    }

    /**
     * Generate response from OpenAI
     * @param prompt Prompt to send to OpenAI
     * @returns Response from OpenAI
     */
    private async generateResponse(prompt: string): Promise<string> {
        // This is a placeholder for the actual OpenAI API call
        // In a real implementation, this would call the OpenAI API
        console.log(`Generating response for prompt: ${prompt.substring(0, 100)}...`);

        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));

        // Return dummy response
        return `ARGUMENT: This is a simulated response for development purposes
CONFIDENCE: 0.8
EVIDENCE:
- This is simulated evidence point 1
- This is simulated evidence point 2
- This is simulated evidence point 3`;
    }

    /**
     * Parse arguments from response text
     * @param response Response text
     * @returns List of arguments
     */
    private parseArgumentsFromResponse(response: string): DebateArgument[] {
        const argumentList: DebateArgument[] = [];

        // Simple regex pattern to extract arguments
        const argPattern = /ARGUMENT: (.*?)(?:\nCONFIDENCE: ([\d.]+))?(?:\nEVIDENCE:\n((?:- .*\n?)*))?/gs;

        let match;
        while ((match = argPattern.exec(response)) !== null) {
            const content = match[1]?.trim() || '';
            const confidence = parseFloat(match[2] || '0.5');

            // Parse evidence points
            const evidenceSection = match[3] || '';
            const evidence = evidenceSection
                .split('\n')
                .filter(line => line.trim().startsWith('- '))
                .map(line => line.trim().substring(2).trim());

            argumentList.push({
                id: uuidv4(),
                content,
                evidence,
                confidence: isNaN(confidence) ? 0.5 : confidence,
                metadata: {}
            });
        }

        // If no arguments were matched, create one from the whole response
        if (argumentList.length === 0 && response.trim()) {
            argumentList.push({
                id: uuidv4(),
                content: response.trim(),
                evidence: [],
                confidence: 0.5,
                metadata: {}
            });
        }

        return argumentList;
    }
} 