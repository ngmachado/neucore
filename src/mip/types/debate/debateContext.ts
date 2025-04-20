import { DebateConfig } from './debateConfig';
import { DebateRound } from './debateRound';

/**
 * Context for a debate session
 */
export interface DebateContext {
    /**
     * Unique identifier for the debate
     */
    id: string;

    /**
     * Original query or problem statement
     */
    query: string;

    /**
     * Additional context or background information
     */
    background?: string;

    /**
     * Debate configuration
     */
    config: DebateConfig;

    /**
     * Current round number
     */
    currentRound: number;

    /**
     * History of completed rounds
     */
    rounds: DebateRound[];

    /**
     * Start time of the debate
     */
    startTime: Date;

    /**
     * Whether the debate has reached consensus
     */
    consensusReached: boolean;

    /**
     * Additional metadata
     */
    metadata: Record<string, any>;
} 