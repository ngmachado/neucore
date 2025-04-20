import { DebateArgument } from './debateArgument';

/**
 * Represents a single round in a debate
 */
export interface DebateRound {
    /**
     * Round identifier (1-based)
     */
    id: number;

    /**
     * Arguments from the proposer
     */
    proposerArguments: DebateArgument[];

    /**
     * Arguments from the critic
     */
    criticArguments: DebateArgument[];

    /**
     * Time when the round started
     */
    startTime: Date;

    /**
     * Time when the round ended
     */
    endTime: Date;

    /**
     * Additional round metadata
     */
    metadata: Record<string, any>;
} 