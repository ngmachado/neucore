/**
 * Dialogic Reasoner for NeuroCore
 * 
 * This module implements a dialogic reasoning approach where two AI providers
 * engage in a constructive dialog: one proposes solutions while the other
 * critiques and offers alternative perspectives.
 */

import {
    BaseReasoner,
    ReasoningResult,
    ReasoningProgress
} from './reasoner';
import {
    ReasoningGraph,
    ReasoningMethod,
    ReasoningOptions,
    ReasoningNodeType
} from './types';
import { IModelProvider } from '../providers/modelProvider';
import { v4 as uuidv4 } from 'uuid';

/**
 * Additional options specific to dialogic reasoning
 */
export interface DialogicReasoningOptions {
    /**
     * Maximum number of dialog turns
     */
    maxTurns?: number;

    /**
     * Minimum number of dialog turns
     */
    minTurns?: number;

    /**
     * Whether to use different temperatures for proposer vs critic
     */
    differentTemperatures?: boolean;

    /**
     * Temperature for the proposer
     */
    proposerTemperature?: number;

    /**
     * Temperature for the critic
     */
    criticTemperature?: number;

    /**
     * Whether to have a final synthesis phase
     */
    includeSynthesis?: boolean;

    /**
     * Whether to stop when consensus is reached
     */
    stopOnConsensus?: boolean;

    /**
     * Consensus threshold (0-1)
     */
    consensusThreshold?: number;
}

/**
 * Dialogic roles in the reasoning process
 */
enum DialogicRole {
    PROPOSER = 'proposer',
    CRITIC = 'critic',
    SYNTHESIS = 'synthesis'
}

/**
 * Implements dialogic reasoning through an AI-to-AI dialog
 */
export class DialogicReasoner extends BaseReasoner {
    /**
     * Provider for the proposer role
     */
    private proposerProvider: IModelProvider;

    /**
     * Provider for the critic role
     */
    private criticProvider: IModelProvider;

    /**
     * Constructor for DialogicReasoner
     * 
     * @param proposerProvider Provider for the proposer role
     * @param criticProvider Provider for the critic role
     * @param defaultOptions Default reasoning options
     */
    constructor(
        proposerProvider: IModelProvider,
        criticProvider: IModelProvider,
        defaultOptions: Partial<ReasoningOptions & DialogicReasoningOptions> = {}
    ) {
        super(proposerProvider, defaultOptions);
        this.proposerProvider = proposerProvider;
        this.criticProvider = criticProvider;
    }

    /**
     * Get the reasoning method
     */
    getMethod(): ReasoningMethod {
        return ReasoningMethod.DIALOGIC;
    }

    /**
     * Perform dialogic reasoning on a query
     * 
     * @param query Query or problem to reason about
     * @param options Reasoning options
     * @returns Result of the reasoning process
     */
    async reason(
        query: string,
        options?: Partial<ReasoningOptions & DialogicReasoningOptions>
    ): Promise<ReasoningResult> {
        // Merge options
        const mergedOptions = {
            ...this.defaultOptions,
            maxTurns: 5,
            minTurns: 2,
            differentTemperatures: true,
            proposerTemperature: 0.7,
            criticTemperature: 0.9,
            includeSynthesis: true,
            stopOnConsensus: true,
            consensusThreshold: 0.8,
            ...options
        };

        // Create graph
        const graph = this.createGraph(query, ReasoningMethod.DIALOGIC);

        // Start timing
        const startTime = Date.now();

        // Track current turn
        let currentTurn = 0;

        // Track consensus level
        let consensusLevel = 0;

        // Add initial node for the problem statement
        const problemNode = this.addNode(
            graph,
            ReasoningNodeType.QUESTION,
            query,
            1.0,
            { role: 'system' }
        );

        try {
            // Initial solution proposal
            let currentProposal = await this.generateProposal(
                query,
                [],
                mergedOptions
            );

            const initialProposalNode = this.addNode(
                graph,
                ReasoningNodeType.INFERENCE,
                currentProposal,
                0.7,
                { role: DialogicRole.PROPOSER, turn: currentTurn }
            );

            // Connect problem to initial proposal
            this.addEdge(graph, problemNode, initialProposalNode, 'initial_proposal');

            // Report progress
            this.reportDialogProgress(
                currentProposal,
                DialogicRole.PROPOSER,
                currentTurn,
                mergedOptions.maxTurns
            );

            // Previous nodes for tracking the conversation
            let previousProposalNode = initialProposalNode;
            let previousCritiqueNode = null;

            // History for context
            const dialogHistory = [
                { role: 'system', content: "Reason through this problem step by step." },
                { role: 'user', content: query },
                { role: 'assistant', content: currentProposal }
            ];

            // Main dialog loop
            while (
                currentTurn < mergedOptions.maxTurns &&
                (currentTurn < mergedOptions.minTurns ||
                    (mergedOptions.stopOnConsensus && consensusLevel < mergedOptions.consensusThreshold))
            ) {
                currentTurn++;

                // Generate critique
                const critique = await this.generateCritique(
                    query,
                    currentProposal,
                    dialogHistory,
                    mergedOptions
                );

                // Add to dialog history
                dialogHistory.push({ role: 'user', content: critique });

                // Add critique node
                const critiqueNode = this.addNode(
                    graph,
                    ReasoningNodeType.ANALYSIS,
                    critique,
                    0.7,
                    { role: DialogicRole.CRITIC, turn: currentTurn }
                );

                // Connect previous proposal to critique
                this.addEdge(graph, previousProposalNode, critiqueNode, 'critique');

                // Report progress
                this.reportDialogProgress(
                    critique,
                    DialogicRole.CRITIC,
                    currentTurn,
                    mergedOptions.maxTurns
                );

                // Generate refined proposal
                const refinedProposal = await this.generateRefinedProposal(
                    query,
                    critique,
                    dialogHistory,
                    mergedOptions
                );

                // Add to dialog history
                dialogHistory.push({ role: 'assistant', content: refinedProposal });

                // Add refined proposal node
                const refinedProposalNode = this.addNode(
                    graph,
                    ReasoningNodeType.INFERENCE,
                    refinedProposal,
                    0.7 + (0.05 * currentTurn), // Confidence increases slightly each turn
                    { role: DialogicRole.PROPOSER, turn: currentTurn }
                );

                // Connect critique to refined proposal
                this.addEdge(graph, critiqueNode, refinedProposalNode, 'refinement');

                // Check for consensus/convergence
                consensusLevel = this.calculateConsensus(
                    currentProposal,
                    refinedProposal,
                    critique
                );

                // Update current proposal
                currentProposal = refinedProposal;
                previousProposalNode = refinedProposalNode;
                previousCritiqueNode = critiqueNode;

                // Report progress
                this.reportDialogProgress(
                    refinedProposal,
                    DialogicRole.PROPOSER,
                    currentTurn,
                    mergedOptions.maxTurns,
                    consensusLevel
                );
            }

            // Final synthesis (if enabled)
            let conclusion = currentProposal;
            let confidence = 0.7 + (0.05 * currentTurn);

            if (mergedOptions.includeSynthesis) {
                conclusion = await this.generateSynthesis(
                    query,
                    dialogHistory,
                    mergedOptions
                );

                // Add synthesis node
                const synthesisNode = this.addNode(
                    graph,
                    ReasoningNodeType.INFERENCE,
                    conclusion,
                    0.9,
                    { role: DialogicRole.SYNTHESIS }
                );

                // Connect previous nodes to synthesis
                this.addEdge(graph, previousProposalNode, synthesisNode, 'synthesis_input');
                if (previousCritiqueNode) {
                    this.addEdge(graph, previousCritiqueNode, synthesisNode, 'synthesis_input');
                }

                confidence = 0.9; // Higher confidence for synthesis

                // Report progress
                this.reportDialogProgress(
                    conclusion,
                    DialogicRole.SYNTHESIS,
                    currentTurn + 1,
                    mergedOptions.maxTurns + 1
                );
            }

            // Set conclusion
            graph.conclusion = conclusion;

            // Calculate time taken
            const timeTaken = Date.now() - startTime;

            return {
                graph,
                conclusion,
                confidence,
                timeTaken,
                stepCount: currentTurn * 2 + (mergedOptions.includeSynthesis ? 1 : 0),
                success: true
            };
        } catch (error) {
            return {
                graph,
                conclusion: "Failed to complete dialogic reasoning",
                confidence: 0,
                timeTaken: Date.now() - startTime,
                stepCount: currentTurn * 2,
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Continue reasoning from an existing graph
     * 
     * @param graph Existing reasoning graph
     * @param options Reasoning options
     * @returns Updated reasoning result
     */
    async continueReasoning(
        graph: ReasoningGraph,
        options?: Partial<ReasoningOptions & DialogicReasoningOptions>
    ): Promise<ReasoningResult> {
        // Implement continuation logic
        // (We'll implement a simplified version for now)
        const query = graph.query;
        const existingNodes = graph.nodes;

        // Find the latest proposal and critique
        let latestProposal = "";
        let currentTurn = 0;

        for (const node of existingNodes) {
            const metadata = node.metadata || {};
            if (metadata.role === DialogicRole.PROPOSER &&
                metadata.turn && metadata.turn > currentTurn) {
                latestProposal = node.content;
                currentTurn = metadata.turn;
            }
        }

        if (!latestProposal) {
            // If we can't find a latest proposal, start fresh
            return this.reason(query, options);
        }

        // Continue with additional turns
        const continuedOptions = {
            ...options,
            minTurns: 1, // At least one more turn
        };

        // Start timing
        const startTime = Date.now();

        try {
            const result = await this.reason(query, continuedOptions);
            return {
                ...result,
                timeTaken: Date.now() - startTime
            };
        } catch (error) {
            return {
                graph,
                conclusion: "Failed to continue dialogic reasoning",
                confidence: 0,
                timeTaken: Date.now() - startTime,
                stepCount: 0,
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Generate initial proposal
     */
    private async generateProposal(
        query: string,
        history: Array<{ role: string, content: string }>,
        options: ReasoningOptions & DialogicReasoningOptions
    ): Promise<string> {
        const systemPrompt =
            "You are an AI assistant tasked with proposing solutions to problems. " +
            "Your goal is to provide a clear, step-by-step solution to the given problem. " +
            "Be thorough, logical, and consider various angles of the problem.";

        const temperature = options.differentTemperatures
            ? options.proposerTemperature
            : options.temperature;

        const response = await this.proposerProvider.generateCompletion({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Please propose a solution to the following problem: ${query}` }
            ],
            temperature,
            model: options.methodOptions?.proposerModel || "default"
        });

        return typeof response.content === 'string'
            ? response.content
            : response.content[0]?.text || "";
    }

    /**
     * Generate critique of the current proposal
     */
    private async generateCritique(
        query: string,
        currentProposal: string,
        history: Array<{ role: string, content: string }>,
        options: ReasoningOptions & DialogicReasoningOptions
    ): Promise<string> {
        const systemPrompt =
            "You are an AI assistant tasked with providing thoughtful critiques of proposed solutions. " +
            "Your goal is to identify weaknesses, oversights, and alternative approaches that weren't considered. " +
            "Be constructive but thorough in your criticism. Ask important questions that " +
            "challenge assumptions and explore different perspectives.";

        const temperature = options.differentTemperatures
            ? options.criticTemperature
            : options.temperature;

        const response = await this.criticProvider.generateCompletion({
            messages: [
                { role: "system", content: systemPrompt },
                ...history.slice(0, -1), // Include everything except the last proposal
                {
                    role: "user",
                    content: `Here is a proposed solution to the problem "${query}":\n\n${currentProposal}\n\n` +
                        `Please critique this solution. What weaknesses, oversights, or alternative approaches ` +
                        `should be considered? What important questions or considerations are missing?`
                }
            ],
            temperature,
            model: options.methodOptions?.criticModel || "default"
        });

        return typeof response.content === 'string'
            ? response.content
            : response.content[0]?.text || "";
    }

    /**
     * Generate refined proposal based on critique
     */
    private async generateRefinedProposal(
        query: string,
        critique: string,
        history: Array<{ role: string, content: string }>,
        options: ReasoningOptions & DialogicReasoningOptions
    ): Promise<string> {
        const systemPrompt =
            "You are an AI assistant tasked with refining solutions based on critical feedback. " +
            "Your goal is to improve the solution by addressing the critiques while maintaining " +
            "the strengths of the original approach. Provide a revised, well-reasoned solution " +
            "that is better than your previous proposal.";

        const temperature = options.differentTemperatures
            ? options.proposerTemperature
            : options.temperature;

        const response = await this.proposerProvider.generateCompletion({
            messages: [
                { role: "system", content: systemPrompt },
                ...history
            ],
            temperature,
            model: options.methodOptions?.proposerModel || "default"
        });

        return typeof response.content === 'string'
            ? response.content
            : response.content[0]?.text || "";
    }

    /**
     * Generate final synthesis of the dialog
     */
    private async generateSynthesis(
        query: string,
        history: Array<{ role: string, content: string }>,
        options: ReasoningOptions & DialogicReasoningOptions
    ): Promise<string> {
        const systemPrompt =
            "You are an AI assistant tasked with synthesizing a final solution from a dialog. " +
            "Review the entire conversation and create a comprehensive, refined solution that " +
            "incorporates the best insights and addresses the criticisms raised throughout the dialog. " +
            "Your synthesis should be well-structured, clear, and represent the best possible solution " +
            "to the original problem.";

        // Use the proposer for synthesis, but could also use a third provider
        const response = await this.proposerProvider.generateCompletion({
            messages: [
                { role: "system", content: systemPrompt },
                ...history,
                {
                    role: "user",
                    content: `Based on the above dialog about the problem "${query}", please synthesize a final, comprehensive solution.`
                }
            ],
            temperature: 0.5, // Lower temperature for synthesis
            model: options.methodOptions?.synthesisModel || options.methodOptions?.proposerModel || "default"
        });

        return typeof response.content === 'string'
            ? response.content
            : response.content[0]?.text || "";
    }

    /**
     * Calculate consensus level between proposals
     */
    private calculateConsensus(
        previousProposal: string,
        currentProposal: string,
        critique: string
    ): number {
        // A simple heuristic - in a real implementation, this would be more sophisticated
        // e.g., using embeddings to calculate semantic similarity

        // For now, we'll use a string comparison heuristic
        const previousWords = new Set(previousProposal.toLowerCase().split(/\s+/));
        const currentWords = new Set(currentProposal.toLowerCase().split(/\s+/));

        // Calculate Jaccard similarity
        const previousWordsArray = Array.from(previousWords);
        const intersection = new Set(previousWordsArray.filter(x => currentWords.has(x)));

        // Create union by combining both sets
        const union = new Set();
        previousWords.forEach(word => union.add(word));
        currentWords.forEach(word => union.add(word));

        return intersection.size / union.size;
    }

    /**
     * Report progress specifically for dialogic reasoning
     */
    private reportDialogProgress(
        content: string,
        role: DialogicRole,
        turn: number,
        maxTurns: number,
        consensusLevel?: number
    ): void {
        if (!this.progressCallback) return;

        const step = {
            id: uuidv4(),
            description: `${role === DialogicRole.PROPOSER ? 'Proposal' :
                role === DialogicRole.CRITIC ? 'Critique' : 'Synthesis'} - Turn ${turn}`,
            content,
            type: role === DialogicRole.PROPOSER ? ReasoningNodeType.INFERENCE :
                role === DialogicRole.CRITIC ? ReasoningNodeType.ANALYSIS :
                    ReasoningNodeType.INFERENCE,
            timestamp: Date.now()
        };

        this.progressCallback({
            currentStep: step,
            stepNumber: turn * 2 + (role === DialogicRole.PROPOSER ? 0 : 1),
            totalSteps: maxTurns * 2,
            interimConclusion: role === DialogicRole.PROPOSER ? content : undefined,
            confidence: role === DialogicRole.SYNTHESIS ? 0.9 :
                role === DialogicRole.PROPOSER ? (0.7 + 0.05 * turn) : undefined
        });
    }
} 