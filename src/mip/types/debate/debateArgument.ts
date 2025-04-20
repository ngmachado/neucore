/**
 * Represents a single argument in a debate
 */
export interface DebateArgument {
    /**
     * Unique identifier for the argument
     */
    id: string;

    /**
     * Main content of the argument
     */
    content: string;

    /**
     * Supporting evidence for the argument
     */
    evidence: string[];

    /**
     * Confidence level (0-1)
     */
    confidence: number;

    /**
     * Additional metadata
     */
    metadata: Record<string, any>;
} 