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
            path,
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

    /**
     * Parses a conclusion text to extract the conclusion and confidence
     * @private
     */
    private parseConclusion(synthesis: string): { conclusionText: string; confidenceValue: number } {
        // Default values
        let conclusionText = synthesis;
        let confidenceValue = 0.7; // Default confidence

        // Try to extract confidence if specified in format "CONFIDENCE: X.XX"
        const confidenceMatch = synthesis.match(/CONFIDENCE:\s*(0\.\d+|\d+(\.\d+)?)/i);
        if (confidenceMatch && confidenceMatch[1]) {
            const extractedConfidence = parseFloat(confidenceMatch[1]);
            if (!isNaN(extractedConfidence) && extractedConfidence >= 0 && extractedConfidence <= 1) {
                confidenceValue = extractedConfidence;
                // Remove the confidence line from the conclusion
                conclusionText = synthesis.replace(/CONFIDENCE:\s*(0\.\d+|\d+(\.\d+)?)/i, '').trim();
            }
        }

        // Try to extract conclusion if specified in format "CONCLUSION: ..."
        const conclusionMatch = conclusionText.match(/CONCLUSION:\s*([\s\S]*)/i);
        if (conclusionMatch && conclusionMatch[1]) {
            conclusionText = conclusionMatch[1].trim();
        }

        return { conclusionText, confidenceValue };
    }

    /**
     * Verifies a conclusion against insights
     * @private
     */
    private async verifyConclusion(
        query: string,
        conclusion: string,
        insights: string[],
        options: ReasoningOptions & SocraticReasoningOptions
    ): Promise<string> {
        const verificationPrompt = `
You are verifying a conclusion against collected insights.

QUERY: ${query}

CONCLUSION:
${conclusion}

INSIGHTS:
${insights.map((insight, i) => `${i + 1}. ${insight}`).join('\n')}

Your task is to evaluate if the conclusion is well-supported by the insights. Consider:
1. Does the conclusion directly address the query?
2. Is the conclusion consistent with the insights?
3. Are there any insights that contradict the conclusion?
4. Are there important aspects from the insights that were omitted?

Then provide a verification score from 0.0 to 1.0, where:
- 0.9-1.0: The conclusion is strongly supported by the insights
- 0.7-0.9: The conclusion is well supported with minor omissions
- 0.5-0.7: The conclusion is partially supported but has some issues
- 0.3-0.5: The conclusion has significant omissions or problems
- 0.0-0.3: The conclusion is not supported or contradicts the insights

FORMAT:
VERIFICATION: Your verification analysis
SCORE: [Score between 0.0 and 1.0]
`;

        const params: CompletionParams = {
            model: options.methodOptions?.model || 'gpt-4',
            messages: [
                {
                    role: 'system',
                    content: 'You are a critical evaluator who verifies that conclusions are well-supported by evidence.'
                },
                {
                    role: 'user',
                    content: verificationPrompt
                }
            ],
            temperature: 0.3 // Low temperature for consistent, critical evaluation
        };

        const response = await this.modelProvider.generateCompletion(params);
        const content = typeof response.content === 'string'
            ? response.content
            : response.content.map(item => item.text || '').join('');

        return content;
    }

    /**
     * Adjusts the confidence based on verification
     * @private
     */
    private adjustConfidence(confidence: number, verification: string): number {
        // Try to extract score from verification
        const scoreMatch = verification.match(/SCORE:\s*(0\.\d+|\d+(\.\d+)?)/i);
        if (scoreMatch && scoreMatch[1]) {
            const verificationScore = parseFloat(scoreMatch[1]);
            if (!isNaN(verificationScore) && verificationScore >= 0 && verificationScore <= 1) {
                // Weight the original confidence (60%) and verification score (40%)
                return confidence * 0.6 + verificationScore * 0.4;
            }
        }

        // If no valid score found, slightly reduce confidence due to uncertainty
        return Math.max(0.1, confidence * 0.9);
    }

    /**
     * Generates follow-up questions based on current insights
     * @private
     */
    private async generateFollowUpQuestions(
        query: string,
        currentQuestion: string,
        answer: string,
        previousInsights: string[],
        options: ReasoningOptions & SocraticReasoningOptions
    ): Promise<string[]> {
        const maxQuestions = Math.min(options.maxQuestions || 5, 7); // Cap at 7 to avoid too many questions

        const prompt = `
You are generating follow-up questions using the Socratic method to explore the following query:
QUERY: ${query}

CURRENT QUESTION: ${currentQuestion}

ANSWER TO CURRENT QUESTION:
${answer}

INSIGHTS ALREADY GATHERED:
${previousInsights.map((insight, i) => `${i + 1}. ${insight}`).join('\n')}

Based on the answer and existing insights, generate ${Math.min(3, maxQuestions)} follow-up questions that would help explore different dimensions of the query. Choose questions that:
1. Address areas not yet covered in existing insights
2. Dig deeper into important points raised in the answer
3. Explore potential contradictions or alternatives
4. Help build a comprehensive understanding of the topic

FORMAT:
QUESTION 1: [Clear, focused follow-up question]
QUESTION 2: [Clear, focused follow-up question]
QUESTION 3: [Clear, focused follow-up question]
`;

        const params: CompletionParams = {
            model: options.methodOptions?.model || 'gpt-4',
            messages: [
                {
                    role: 'system',
                    content: 'You generate insightful follow-up questions using the Socratic method.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.7 // Higher temperature for creative questions
        };

        const response = await this.modelProvider.generateCompletion(params);
        const content = typeof response.content === 'string'
            ? response.content
            : response.content.map(item => item.text || '').join('');

        // Extract questions from the response
        const questions: string[] = [];
        const questionMatches = content.matchAll(/QUESTION \d+:\s*([^\n]+)/g);

        for (const match of questionMatches) {
            if (match[1] && match[1].trim()) {
                questions.push(match[1].trim());
            }
        }

        // If no questions were extracted using the format, fall back to line-by-line extraction
        if (questions.length === 0) {
            const lines = content.split('\n').filter(line => line.trim());
            for (const line of lines) {
                // Skip lines that are just headers or numbers
                if (line.trim() && !line.match(/^(question|follow-up|#|\d+|-)$/i)) {
                    // Remove leading numbers, bullets, etc.
                    const cleaned = line.replace(/^[\d#\-\.\)\s]+/, '').trim();
                    if (cleaned) {
                        questions.push(cleaned);
                    }
                }
            }
        }

        // Cap the number of questions
        return questions.slice(0, maxQuestions);
    }

    /**
     * Generates an answer to a question
     * @private
     */
    private async generateAnswer(
        query: string,
        question: string,
        previousInsights: string[],
        options: ReasoningOptions & SocraticReasoningOptions
    ): Promise<string> {
        const prompt = `
You are answering a question to help explore the following query:
QUERY: ${query}

QUESTION: ${question}

${previousInsights.length > 0 ? `INSIGHTS ALREADY GATHERED:
${previousInsights.map((insight, i) => `${i + 1}. ${insight}`).join('\n')}` : ''}

Please provide a clear, insightful answer to this question. The answer should:
1. Be thorough but concise
2. Consider different perspectives when appropriate
3. Provide factual information
4. Acknowledge limitations or uncertainties
5. Build upon existing insights when relevant

FORMAT:
ANSWER: [Your detailed response to the question]
INSIGHT: [A single, concise sentence that captures the key insight from this answer]
`;

        const params: CompletionParams = {
            model: options.methodOptions?.model || 'gpt-4',
            messages: [
                {
                    role: 'system',
                    content: 'You provide clear, insightful answers to questions in a Socratic exploration.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.5 // Balanced temperature for informed but somewhat creative answers
        };

        const response = await this.modelProvider.generateCompletion(params);
        const content = typeof response.content === 'string'
            ? response.content
            : response.content.map(item => item.text || '').join('');

        return content;
    }

    /**
     * Reports progress in the Socratic reasoning process
     * @private
     */
    private reportSocraticProgress(
        currentPath: {
            currentNode: any;
            questions: string[];
            insights: string[];
        },
        question: string,
        answer: string,
        questionNumber: number,
        maxQuestions: number
    ): void {
        if (!this.progressCallback) {
            return;
        }

        const currentStep = this.createStep(
            ReasoningNodeType.QUESTION,
            `Question ${questionNumber}/${maxQuestions}`,
            `Q: ${question}\n\nA: ${answer}`
        );

        this.progressCallback({
            currentStep,
            stepNumber: questionNumber,
            totalSteps: maxQuestions,
            interimConclusion: currentPath.insights.length > 0
                ? `Current insights: ${currentPath.insights.length}`
                : undefined
        });
    }
}