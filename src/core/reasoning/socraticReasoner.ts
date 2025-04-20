/**
 * Socratic Reasoner for NeuroCore
 * 
 * This module implements a Socratic reasoning approach where the model
 * uses a series of questions and answers to explore a problem from multiple angles.
 */

import {
    BaseReasoner,
    ReasoningResult
} from './reasoner';
import {
    ReasoningGraph,
    ReasoningMethod,
    ReasoningOptions,
    ReasoningNodeType
} from './types';
import { CompletionParams } from '../providers/modelProvider';
import { v4 as uuidv4 } from 'uuid';

/**
 * Socratic reasoning specific options
 */
export interface SocraticReasoningOptions {
    /**
     * Maximum number of question-answer pairs
     */
    maxQuestions?: number;

    /**
     * Minimum number of question-answer pairs
     */
    minQuestions?: number;

    /**
     * Whether to include a verification phase
     */
    includeVerification?: boolean;

    /**
     * Whether to include a synthesis phase
     */
    includeSynthesis?: boolean;

    /**
     * Initial questions to start with
     */
    seedQuestions?: string[];

    /**
     * Whether to pursue multiple question paths in parallel
     */
    exploreBranches?: boolean;

    /**
     * Maximum branches to explore if exploreBranches is true
     */
    maxBranches?: number;
}

/**
 * Types of nodes in the Socratic reasoning process
 */
enum SocraticNodeType {
    QUESTION = 'question',
    ANSWER = 'answer',
    SYNTHESIS = 'synthesis',
    VERIFICATION = 'verification'
}

/**
 * Implements Socratic reasoning through question-answer exploration
 */
export class SocraticReasoner extends BaseReasoner {
    /**
     * Get the reasoning method
     */
    getMethod(): ReasoningMethod {
        return ReasoningMethod.SOCRATIC;
    }

    /**
     * Perform Socratic reasoning on a query
     * 
     * @param query Query or problem to reason about
     * @param options Reasoning options
     * @returns Result of the reasoning process
     */
    async reason(
        query: string,
        options?: Partial<ReasoningOptions & SocraticReasoningOptions>
    ): Promise<ReasoningResult> {
        console.log(`[SOCRATIC] Starting Socratic reasoning for query: "${query.substring(0, 100)}..."`);

        // Merge options
        const mergedOptions = {
            ...this.defaultOptions,
            maxQuestions: 5,
            minQuestions: 3,
            includeVerification: true,
            includeSynthesis: true,
            exploreBranches: false,
            maxBranches: 2,
            ...options
        };

        console.log(`[SOCRATIC] Using options: maxQuestions=${mergedOptions.maxQuestions}, minQuestions=${mergedOptions.minQuestions}`);
        console.log(`[SOCRATIC] includeSynthesis=${mergedOptions.includeSynthesis}, includeVerification=${mergedOptions.includeVerification}`);

        // Create graph
        const graph = this.createGraph(query, ReasoningMethod.SOCRATIC);

        // Start timing
        const startTime = Date.now();

        try {
            // Add initial node for the problem statement
            const problemNode = this.addNode(
                graph,
                ReasoningNodeType.QUESTION,
                query,
                1.0,
                { role: 'problem' }
            );

            // Generate initial questions
            console.log(`[SOCRATIC] Generating initial questions...`);
            const initialQuestions = await this.generateInitialQuestions(
                query,
                mergedOptions
            );
            console.log(`[SOCRATIC] Generated ${initialQuestions.length} initial questions`);
            initialQuestions.forEach((q, i) => console.log(`[SOCRATIC] Question ${i + 1}: ${q.substring(0, 100)}...`));

            // Track current question count
            let questionCount = 0;

            // Start with a single path
            const paths = [
                {
                    currentNode: problemNode,
                    questions: initialQuestions,
                    insights: []
                }
            ];

            // If we're exploring branches
            if (mergedOptions.exploreBranches) {
                // Process each path up to the minimum questions
                while (paths.some(path => path.questions.length > 0 && path.insights.length < mergedOptions.minQuestions)) {
                    for (const path of paths) {
                        if (path.questions.length > 0 && path.insights.length < mergedOptions.minQuestions) {
                            await this.processQuestionPath(graph, path, query, questionCount, mergedOptions);
                            questionCount++;
                        }
                    }

                    // If we have capacity for more branches and we have paths with questions
                    if (paths.length < mergedOptions.maxBranches) {
                        // Find the path with the most remaining questions
                        const pathIndex = paths.findIndex(p => p.questions.length > 0);
                        if (pathIndex >= 0) {
                            // Clone the path and add it
                            const newPath = { ...paths[pathIndex] };
                            paths.push(newPath);
                        }
                    }
                }
            } else {
                // Process a single path
                const path = paths[0];
                while (path.questions.length > 0 && path.insights.length < mergedOptions.maxQuestions) {
                    await this.processQuestionPath(graph, path, query, questionCount, mergedOptions);
                    questionCount++;
                }
            }

            // Synthesize all insights from all paths
            const allInsights = paths.flatMap(path => path.insights);

            // Generate synthesis
            let conclusion = '';
            let confidence = 0.7;

            if (mergedOptions.includeSynthesis && allInsights.length > 0) {
                const synthesis = await this.generateSynthesis(
                    query,
                    allInsights,
                    mergedOptions
                );

                // Extract conclusion and confidence
                const { conclusionText, confidenceValue } = this.parseConclusion(synthesis);
                conclusion = conclusionText;
                confidence = confidenceValue;

                // Add synthesis node
                const synthesisNode = this.addNode(
                    graph,
                    ReasoningNodeType.INFERENCE,
                    conclusion,
                    confidence,
                    { role: SocraticNodeType.SYNTHESIS }
                );

                // Connect all final nodes from each path to synthesis
                for (const path of paths) {
                    if (path.currentNode) {
                        this.addEdge(graph, path.currentNode, synthesisNode, 'synthesis_input');
                    }
                }
            } else {
                // If no synthesis, use the last insight as conclusion
                conclusion = allInsights.length > 0 ?
                    allInsights[allInsights.length - 1] :
                    "No insights were generated through Socratic questioning.";
            }

            // Verification phase
            if (mergedOptions.includeVerification) {
                const verification = await this.verifyConclusion(
                    query,
                    conclusion,
                    allInsights,
                    mergedOptions
                );

                // Add verification node
                const verificationNode = this.addNode(
                    graph,
                    ReasoningNodeType.REFLECTION,
                    verification,
                    undefined,
                    { role: SocraticNodeType.VERIFICATION }
                );

                // Find synthesis node or last node
                const lastNode = graph.nodes.find(node =>
                    node.metadata?.role === SocraticNodeType.SYNTHESIS
                ) || paths[0].currentNode;

                // Connect last node to verification
                if (lastNode) {
                    this.addEdge(graph, lastNode, verificationNode, 'verifies');
                }

                // Adjust confidence based on verification
                confidence = this.adjustConfidence(confidence, verification);
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
                stepCount: questionCount,
                success: true
            };
        } catch (error) {
            return {
                graph,
                conclusion: "Failed to complete Socratic reasoning",
                confidence: 0,
                timeTaken: Date.now() - startTime,
                stepCount: 0,
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
        options?: Partial<ReasoningOptions & SocraticReasoningOptions>
    ): Promise<ReasoningResult> {
        const startTime = Date.now();

        // Merge options
        const mergedOptions = {
            ...this.defaultOptions,
            maxQuestions: 3, // Fewer questions for continuation
            minQuestions: 1,
            includeVerification: true,
            includeSynthesis: true,
            exploreBranches: false,
            maxBranches: 2,
            ...options
        };

        try {
            // Get the existing insights from the graph
            const existingInsights: string[] = [];

            // Find answer nodes and extract their content
            for (const node of graph.nodes) {
                if (node.metadata?.role === SocraticNodeType.ANSWER) {
                    existingInsights.push(node.content);
                }
            }

            // Find the last node in the graph
            const nodes = [...graph.nodes].sort((a, b) => b.timestamp - a.timestamp);
            const lastNode = nodes[0];

            if (!lastNode) {
                throw new Error('No existing nodes in graph');
            }

            // Generate new questions based on existing insights
            const newQuestions = await this.generateFollowUpQuestions(
                graph.query,
                "Previous inquiry", // Placeholder for previous question
                "Previous exploration", // Placeholder for previous answer
                existingInsights,
                mergedOptions
            );

            // Start with the path continuing from the last node
            const path = {
                currentNode: lastNode,
                questions: newQuestions,
                insights: existingInsights
            };

            // Track question count
            let questionCount = existingInsights.length;

            // Continue the questioning process
            while (path.questions.length > 0 &&
                path.insights.length < existingInsights.length + mergedOptions.maxQuestions) {
                await this.processQuestionPath(graph, path, graph.query, questionCount, mergedOptions);
                questionCount++;
            }

            // Get all insights
            const allInsights = path.insights;

            // Generate synthesis if needed
            let conclusion = graph.conclusion || '';
            let confidence = 0.7;

            if (mergedOptions.includeSynthesis && allInsights.length > existingInsights.length) {
                // Only synthesize if we have new insights
                const synthesis = await this.generateSynthesis(
                    graph.query,
                    allInsights,
                    mergedOptions
                );

                // Extract conclusion and confidence
                const { conclusionText, confidenceValue } = this.parseConclusion(synthesis);
                conclusion = conclusionText;
                confidence = confidenceValue;

                // Add synthesis node
                const synthesisNode = this.addNode(
                    graph,
                    ReasoningNodeType.INFERENCE,
                    conclusion,
                    confidence,
                    { role: SocraticNodeType.SYNTHESIS }
                );

                // Connect last node to synthesis
                this.addEdge(graph, path.currentNode, synthesisNode, 'synthesis_input');
            }

            // Verification phase
            if (mergedOptions.includeVerification) {
                const verification = await this.verifyConclusion(
                    graph.query,
                    conclusion,
                    allInsights,
                    mergedOptions
                );

                // Add verification node
                const verificationNode = this.addNode(
                    graph,
                    ReasoningNodeType.REFLECTION,
                    verification,
                    undefined,
                    { role: SocraticNodeType.VERIFICATION }
                );

                // Find synthesis node or last node
                const lastNode = graph.nodes.find(node =>
                    node.metadata?.role === SocraticNodeType.SYNTHESIS
                ) || path.currentNode;

                // Connect last node to verification
                if (lastNode) {
                    this.addEdge(graph, lastNode, verificationNode, 'verifies');
                }

                // Adjust confidence based on verification
                confidence = this.adjustConfidence(confidence, verification);
            }

            // Set conclusion
            graph.conclusion = conclusion;

            const timeTaken = Date.now() - startTime;

            return {
                graph,
                conclusion,
                confidence,
                timeTaken,
                stepCount: questionCount - existingInsights.length, // Only count new steps
                success: true
            };
        } catch (error) {
            return {
                graph,
                conclusion: graph.conclusion || "Failed to continue Socratic reasoning",
                confidence: 0,
                timeTaken: Date.now() - startTime,
                stepCount: 0,
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Process a single question path
     */
    private async processQuestionPath(
        graph: ReasoningGraph,
        path: {
            currentNode: any;
            questions: string[];
            insights: string[];
        },
        query: string,
        questionCount: number,
        options: ReasoningOptions & SocraticReasoningOptions
    ): Promise<void> {
        // Take the next question
        const question = path.questions.shift();
        if (!question) return;

        console.log(`[SOCRATIC] Processing question ${questionCount + 1}: "${question.substring(0, 100)}..."`);

        // Add question node
        const questionNode = this.addNode(
            graph,
            ReasoningNodeType.QUESTION,
            question,
            undefined,
            { role: SocraticNodeType.QUESTION, questionNumber: questionCount }
        );

        // Connect from current node
        this.addEdge(graph, path.currentNode, questionNode, 'asks');

        // Generate answer
        console.log(`[SOCRATIC] Generating answer for question ${questionCount + 1}...`);
        const answer = await this.generateAnswer(
            query,
            question,
            path.insights,
            options
        );
        console.log(`[SOCRATIC] Generated answer (${answer.length} chars): "${answer.substring(0, 100)}..."`);

        // Add answer node
        const answerNode = this.addNode(
            graph,
            ReasoningNodeType.INFERENCE,
            answer,
            undefined,
            { role: SocraticNodeType.ANSWER, questionNumber: questionCount }
        );

        // Connect question to answer
        this.addEdge(graph, questionNode, answerNode, 'answers');

        // Add insight to path
        path.insights.push(answer);

        // Generate follow-up questions if needed
        if (path.questions.length === 0 && path.insights.length < options.maxQuestions!) {
            console.log(`[SOCRATIC] Generating follow-up questions after question ${questionCount + 1}...`);
            const followUpQuestions = await this.generateFollowUpQuestions(
                query,
                question,
                answer,
                path.insights,
                options
            );
            console.log(`[SOCRATIC] Generated ${followUpQuestions.length} follow-up questions`);
            followUpQuestions.forEach((q, i) =>
                console.log(`[SOCRATIC] Follow-up question ${i + 1}: ${q.substring(0, 100)}...`));

            // Add new questions to this path
            path.questions.push(...followUpQuestions);
        }

        // Update current node
        path.currentNode = answerNode;

        // Report progress
        this.reportSocraticProgress(
            question,
            answer,
            questionCount + 1,
            options.maxQuestions || 5  // Default if undefined
        );
    }

    /**
     * Generate initial questions
     */
    private async generateInitialQuestions(
        query: string,
        options: ReasoningOptions & SocraticReasoningOptions
    ): Promise<string[]> {
        if (options.seedQuestions && options.seedQuestions.length > 0) {
            return options.seedQuestions;
        }

        const systemPrompt =
            "You are a master of Socratic questioning. Your task is to generate initial questions " +
            "that will help explore the given problem from multiple angles. Generate thoughtful " +
            "questions that probe assumptions, clarify concepts, examine evidence, and explore implications. " +
            "Each question should be distinct and address a different aspect of the problem.";

        const params: CompletionParams = {
            messages: [
                { role: "system", content: systemPrompt },
                {
                    role: "user",
                    content: `I need to explore this problem through Socratic questioning: "${query}"\n\n`
                }
            ],
            temperature: 0.5,
            model: options.methodOptions?.model || "default"
        };

        console.log(`[SOCRATIC] Requesting initial questions with temperature ${params.temperature}...`);
        const response = await this.modelProvider.generateCompletion(params);

        const result = typeof response.content === 'string'
            ? response.content
            : response.content[0]?.text || "";

        console.log(`[SOCRATIC] Generated initial questions (${result.length} chars): "${result.substring(0, 100)}..."`);

        return result.split('\n').filter(q => q.trim() !== '');
    }

    private async generateSynthesis(
        query: string,
        insights: string[],
        options: ReasoningOptions & SocraticReasoningOptions
    ): Promise<string> {
        console.log(`[SOCRATIC] Generating synthesis from ${insights.length} insights...`);

        // Use custom system instructions if provided, otherwise use default
        const systemPrompt = options.methodOptions?.systemInstructions ||
            "You are an expert in synthesizing complex information. Your task is to integrate the insights " +
            "from a Socratic questioning process into a coherent conclusion. Provide a clear synthesis " +
            "that captures the key discoveries, resolves tensions where possible, and offers a well-supported " +
            "answer to the original problem. Include a confidence level (0-100%) in your conclusion.";

        console.log(`[SOCRATIC] Using system instructions: ${options.methodOptions?.systemInstructions ? 'Custom' : 'Default'}`);

        const insightsText = insights.map((insight, i) =>
            `Insight ${i + 1}: ${insight}`
        ).join("\n\n");

        // Adjust the user prompt based on whether we're using custom instructions
        const userPrompt = options.methodOptions?.systemInstructions
            ? `Here is the problem: "${query}"\n\n` +
            "Here are the insights generated:\n\n" +
            insightsText + "\n\n" +
            "Please provide a comprehensive response to this problem."
            : `I've explored this problem through Socratic questioning: "${query}"\n\n` +
            "Here are the insights generated:\n\n" +
            insightsText + "\n\n" +
            "Please synthesize these insights into a coherent conclusion. End with a confidence " +
            "level statement in this format: 'Confidence: X%' where X is a number between 0 and 100.";

        const params: CompletionParams = {
            messages: [
                { role: "system", content: systemPrompt },
                {
                    role: "user",
                    content: userPrompt
                }
            ],
            temperature: 0.5, // Lower temperature for synthesis
            model: options.methodOptions?.model || "default"
        };

        console.log(`[SOCRATIC] Requesting synthesis with temperature ${params.temperature}...`);
        const response = await this.modelProvider.generateCompletion(params);

        const result = typeof response.content === 'string'
            ? response.content
            : response.content[0]?.text || "";

        console.log(`[SOCRATIC] Generated synthesis (${result.length} chars): "${result.substring(0, 100)}..."`);

        return result;
    }
}