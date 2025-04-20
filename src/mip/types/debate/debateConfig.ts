/**
 * Configuration for a debate session
 */
export interface DebateConfig {
    /**
     * Maximum number of rounds
     */
    maxRounds: number;

    /**
     * Time limit per round in milliseconds
     */
    timeLimit: number;

    /**
     * Confidence threshold for accepting a solution
     */
    confidenceThreshold: number;

    /**
     * Strategy for resolving debates
     * - 'consensus': Require agreement between participants
     * - 'majority': Accept solution with highest confidence
     * - 'proposer': Favor the proposer's final argument
     * - 'critic': Favor the critic's final argument
     */
    resolutionStrategy: 'consensus' | 'majority' | 'proposer' | 'critic';

    /**
     * Weights for different providers in the debate
     */
    providerWeights?: Record<string, number>;

    /**
     * Whether to enable human review for non-consensus outcomes
     */
    humanReviewEnabled: boolean;
} 