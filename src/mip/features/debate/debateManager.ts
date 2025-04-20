import { v4 as uuidv4 } from 'uuid';
import { DebateParticipant } from '../../interfaces/debate/debateParticipant';
import { DebateContext } from '../../types/debate/debateContext';
import { DebateConfig } from '../../types/debate/debateConfig';
import { DebateRound } from '../../types/debate/debateRound';
import { DebateResult } from '../../types/debate/debateResult';
import { DebateArgument } from '../../types/debate/debateArgument';

/**
 * Default debate configuration
 */
const DEFAULT_CONFIG: DebateConfig = {
    maxRounds: 3,
    timeLimit: 30000, // 30 seconds
    confidenceThreshold: 0.8,
    resolutionStrategy: 'consensus',
    humanReviewEnabled: false
};

/**
 * Manages debate sessions between AI providers
 */
export class DebateManager {
    /**
     * Create a new debate session
     * @param query Original query or problem statement
     * @param proposer Provider acting as the proposer
     * @param critic Provider acting as the critic
     * @param config Debate configuration
     * @returns Debate context
     */
    public createDebate(
        query: string,
        proposer: DebateParticipant,
        critic: DebateParticipant,
        config: Partial<DebateConfig> = {}
    ): DebateContext {
        const fullConfig: DebateConfig = { ...DEFAULT_CONFIG, ...config };

        return {
            id: uuidv4(),
            query,
            config: fullConfig,
            currentRound: 0,
            rounds: [],
            startTime: new Date(),
            consensusReached: false,
            metadata: {
                proposer: proposer.constructor.name,
                critic: critic.constructor.name
            }
        };
    }

    /**
     * Execute a complete debate session
     * @param context Debate context
     * @param proposer Provider acting as the proposer
     * @param critic Provider acting as the critic
     * @returns Debate result
     */
    public async executeDebate(
        context: DebateContext,
        proposer: DebateParticipant,
        critic: DebateParticipant
    ): Promise<DebateResult> {
        const startTime = Date.now();

        try {
            // Initial proposal
            const proposal = await this.executeRound(context, proposer, critic);

            // Continue with rounds until max rounds reached or consensus achieved
            while (
                context.currentRound < context.config.maxRounds &&
                !context.consensusReached
            ) {
                await this.executeRound(context, proposer, critic);
            }

            // Generate final result
            const result = await this.generateResult(context, proposer, critic);
            result.duration = Date.now() - startTime;

            return result;
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Debate execution failed: ${errorMessage}`);
        }
    }

    /**
     * Execute a single round of debate
     * @param context Debate context
     * @param proposer Provider acting as the proposer
     * @param critic Provider acting as the critic
     * @returns Updated debate round
     */
    private async executeRound(
        context: DebateContext,
        proposer: DebateParticipant,
        critic: DebateParticipant
    ): Promise<DebateRound> {
        const roundId = context.currentRound + 1;
        const startTime = new Date();

        // Create new round
        const round: DebateRound = {
            id: roundId,
            proposerArguments: [],
            criticArguments: [],
            startTime,
            endTime: startTime, // Initialize with start time, will be updated later
            metadata: {}
        };

        try {
            // If first round, get initial proposal
            if (roundId === 1) {
                round.proposerArguments = await proposer.propose(context);
            } else {
                // Otherwise respond to previous critiques
                const previousRound = context.rounds[roundId - 2];
                round.proposerArguments = await proposer.respond(
                    context,
                    previousRound.criticArguments
                );
            }

            // Get critiques from critic
            round.criticArguments = await critic.critique(
                context,
                round.proposerArguments
            );

            // Check for consensus
            context.consensusReached = this.checkConsensus(
                round.proposerArguments,
                round.criticArguments
            );

            // Update round
            round.endTime = new Date();
            context.rounds.push(round);
            context.currentRound = roundId;

            return round;
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Round ${roundId} execution failed: ${errorMessage}`);
        }
    }

    /**
     * Check if consensus has been reached between arguments
     * @param proposerArgs Proposer arguments
     * @param criticArgs Critic arguments
     * @returns Whether consensus has been reached
     */
    private checkConsensus(
        proposerArgs: DebateArgument[],
        criticArgs: DebateArgument[]
    ): boolean {
        // Simple implementation - if critic has no substantial critiques
        return criticArgs.length === 0 ||
            criticArgs.every(arg => arg.confidence < 0.3);
    }

    /**
     * Generate final result from debate
     * @param context Debate context
     * @param proposer Provider acting as the proposer
     * @param critic Provider acting as the critic
     * @returns Debate result
     */
    private async generateResult(
        context: DebateContext,
        proposer: DebateParticipant,
        critic: DebateParticipant
    ): Promise<DebateResult> {
        const proposerConclusion = await proposer.conclude(context);
        const criticConclusion = await critic.conclude(context);

        // Apply resolution strategy
        let solution: string;
        let confidence: number;
        let reasoning: string;
        let winningProvider: string;

        switch (context.config.resolutionStrategy) {
            case 'consensus':
                if (context.consensusReached) {
                    solution = proposerConclusion.content;
                    confidence = proposerConclusion.confidence;
                    reasoning = proposerConclusion.evidence.join('\n');
                    winningProvider = 'consensus';
                } else {
                    // No consensus, use highest confidence
                    if (proposerConclusion.confidence >= criticConclusion.confidence) {
                        solution = proposerConclusion.content;
                        confidence = proposerConclusion.confidence;
                        reasoning = proposerConclusion.evidence.join('\n');
                        winningProvider = context.metadata.proposer as string;
                    } else {
                        solution = criticConclusion.content;
                        confidence = criticConclusion.confidence;
                        reasoning = criticConclusion.evidence.join('\n');
                        winningProvider = context.metadata.critic as string;
                    }
                }
                break;

            case 'proposer':
                solution = proposerConclusion.content;
                confidence = proposerConclusion.confidence;
                reasoning = proposerConclusion.evidence.join('\n');
                winningProvider = context.metadata.proposer as string;
                break;

            case 'critic':
                solution = criticConclusion.content;
                confidence = criticConclusion.confidence;
                reasoning = criticConclusion.evidence.join('\n');
                winningProvider = context.metadata.critic as string;
                break;

            case 'majority':
                // Simple implementation - just use highest confidence
                if (proposerConclusion.confidence >= criticConclusion.confidence) {
                    solution = proposerConclusion.content;
                    confidence = proposerConclusion.confidence;
                    reasoning = proposerConclusion.evidence.join('\n');
                    winningProvider = context.metadata.proposer as string;
                } else {
                    solution = criticConclusion.content;
                    confidence = criticConclusion.confidence;
                    reasoning = criticConclusion.evidence.join('\n');
                    winningProvider = context.metadata.critic as string;
                }
                break;

            default:
                throw new Error(`Unknown resolution strategy: ${context.config.resolutionStrategy}`);
        }

        // Generate summary
        const summary = this.generateSummary(context);

        return {
            solution,
            confidence,
            reasoning,
            consensusReached: context.consensusReached,
            winningProvider,
            summary,
            duration: 0, // Will be set by caller
            rounds: context.rounds.length,
            metadata: {
                proposerConfidence: proposerConclusion.confidence,
                criticConfidence: criticConclusion.confidence
            }
        };
    }

    /**
     * Generate a summary of the debate
     * @param context Debate context
     * @returns Summary string
     */
    private generateSummary(context: DebateContext): string {
        const roundSummaries = context.rounds.map(round => {
            return `Round ${round.id}:\n` +
                `- Proposer: ${this.summarizeArguments(round.proposerArguments)}\n` +
                `- Critic: ${this.summarizeArguments(round.criticArguments)}`;
        });

        return `Debate on: "${context.query}"\n` +
            `Rounds completed: ${context.rounds.length}\n` +
            `Consensus reached: ${context.consensusReached}\n\n` +
            roundSummaries.join('\n\n');
    }

    /**
     * Summarize a list of arguments
     * @param args Arguments to summarize
     * @returns Summary string
     */
    private summarizeArguments(args: DebateArgument[]): string {
        if (args.length === 0) {
            return 'No arguments';
        }

        const topArg = args.reduce((prev, current) =>
            current.confidence > prev.confidence ? current : prev
        );

        return `${topArg.content} (confidence: ${topArg.confidence.toFixed(2)})`;
    }
} 