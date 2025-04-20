/**
 * Result of a completed debate
 */
export interface DebateResult {
    /**
     * The final solution or answer
     */
    solution: string;

    /**
     * Confidence level in the solution (0-1)
     */
    confidence: number;

    /**
     * Reasoning behind the solution
     */
    reasoning: string;

    /**
     * Whether consensus was reached
     */
    consensusReached: boolean;

    /**
     * Provider that produced the winning argument (if any)
     */
    winningProvider?: string;

    /**
     * Summary of the debate
     */
    summary: string;

    /**
     * Time taken for the entire debate in milliseconds
     */
    duration: number;

    /**
     * Number of rounds completed
     */
    rounds: number;

    /**
     * Additional result metadata
     */
    metadata: Record<string, any>;
} 