import { DebateArgument } from '../../types/debate/debateArgument';
import { DebateContext } from '../../types/debate/debateContext';

/**
 * Interface for debate participants
 * Implemented by provider adapters to participate in debates
 */
export interface DebateParticipant {
    /**
     * Generate an initial proposal for the given context
     * @param context The debate context
     * @returns List of arguments supporting the proposal
     */
    propose(context: DebateContext): Promise<DebateArgument[]>;

    /**
     * Critique a proposal
     * @param context The debate context
     * @param proposal The proposal to critique
     * @returns List of arguments critiquing the proposal
     */
    critique(context: DebateContext, proposal: DebateArgument[]): Promise<DebateArgument[]>;

    /**
     * Respond to critiques
     * @param context The debate context
     * @param critiques The critiques to respond to
     * @returns List of arguments responding to critiques
     */
    respond(context: DebateContext, critiques: DebateArgument[]): Promise<DebateArgument[]>;

    /**
     * Generate a conclusion based on the debate
     * @param context The debate context
     * @returns Final argument concluding the debate
     */
    conclude(context: DebateContext): Promise<DebateArgument>;
} 