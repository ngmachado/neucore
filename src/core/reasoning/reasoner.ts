/**
 * Reasoner Interface for NeuroCore
 * 
 * This module defines the core interface for reasoners that
 * implement different reasoning methods.
 */

import {
    ReasoningGraph,
    ReasoningMethod,
    ReasoningOptions,
    ReasoningStep,
    ReasoningNodeType,
    ReasoningNode,
    ReasoningEdge
} from './types';
import { IModelProvider } from '../providers/modelProvider';
import { UUID } from '../../types';

/**
 * Result of a reasoning process
 */
export interface ReasoningResult {
    /**
     * Reasoning graph representing the process
     */
    graph: ReasoningGraph;

    /**
     * Final conclusion or result
     */
    conclusion: string;

    /**
     * Confidence in the conclusion (0-1)
     */
    confidence: number;

    /**
     * Time taken for reasoning (ms)
     */
    timeTaken: number;

    /**
     * Number of steps/iterations performed
     */
    stepCount: number;

    /**
     * Success status
     */
    success: boolean;

    /**
     * Error message if not successful
     */
    error?: string;
}

/**
 * Progress update during reasoning
 */
export interface ReasoningProgress {
    /**
     * Current step
     */
    currentStep: ReasoningStep;

    /**
     * Current step number
     */
    stepNumber: number;

    /**
     * Total steps performed so far
     */
    totalSteps: number;

    /**
     * Current interim conclusion if available
     */
    interimConclusion?: string;

    /**
     * Current confidence level
     */
    confidence?: number;
}

/**
 * Interface for reasoners
 */
export interface IReasoner {
    /**
     * Get the reasoning method this reasoner implements
     */
    getMethod(): ReasoningMethod;

    /**
     * Perform reasoning on a query
     * 
     * @param query Query or problem to reason about
     * @param options Reasoning options
     * @returns Result of the reasoning process
     */
    reason(query: string, options?: Partial<ReasoningOptions>): Promise<ReasoningResult>;

    /**
     * Continue reasoning from an existing graph
     * 
     * @param graph Existing reasoning graph
     * @param options Reasoning options
     * @returns Updated reasoning result
     */
    continueReasoning(graph: ReasoningGraph, options?: Partial<ReasoningOptions>): Promise<ReasoningResult>;

    /**
     * Set a callback for progress updates
     * 
     * @param callback Progress callback function
     */
    setProgressCallback(callback: (progress: ReasoningProgress) => void): void;
}

/**
 * Base abstract class for reasoners
 */
export abstract class BaseReasoner implements IReasoner {
    /**
     * Model provider for generating text
     */
    protected modelProvider: IModelProvider;

    /**
     * Default reasoning options
     */
    protected defaultOptions: ReasoningOptions;

    /**
     * Progress callback
     */
    protected progressCallback?: (progress: ReasoningProgress) => void;

    /**
     * Create a new base reasoner
     * 
     * @param modelProvider Model provider for generating text
     * @param defaultOptions Default reasoning options
     */
    constructor(modelProvider: IModelProvider, defaultOptions: Partial<ReasoningOptions>) {
        this.modelProvider = modelProvider;
        this.defaultOptions = {
            method: this.getMethod(),
            maxDepth: 10,
            maxBranches: 3,
            useBackgroundKnowledge: true,
            temperature: 0.7,
            enableReflection: true,
            maxIterations: 15,
            confidenceThreshold: 0.95,
            ...defaultOptions
        };
    }

    /**
     * Get the reasoning method this reasoner implements
     */
    abstract getMethod(): ReasoningMethod;

    /**
     * Perform reasoning on a query
     * 
     * @param query Query or problem to reason about
     * @param options Reasoning options
     * @returns Result of the reasoning process
     */
    abstract reason(query: string, options?: Partial<ReasoningOptions>): Promise<ReasoningResult>;

    /**
     * Continue reasoning from an existing graph
     * 
     * @param graph Existing reasoning graph
     * @param options Reasoning options
     * @returns Updated reasoning result
     */
    abstract continueReasoning(graph: ReasoningGraph, options?: Partial<ReasoningOptions>): Promise<ReasoningResult>;

    /**
     * Set a callback for progress updates
     * 
     * @param callback Progress callback function
     */
    setProgressCallback(callback: (progress: ReasoningProgress) => void): void {
        this.progressCallback = callback;
    }

    /**
     * Create a new reasoning graph
     * 
     * @param query Query or problem
     * @param method Reasoning method
     * @returns New reasoning graph
     */
    protected createGraph(query: string, method: ReasoningMethod): ReasoningGraph {
        const now = Date.now();

        return {
            id: this.generateId(),
            nodes: [],
            edges: [],
            method,
            query,
            createdAt: now,
            updatedAt: now
        };
    }

    /**
     * Add a node to a reasoning graph
     * 
     * @param graph Reasoning graph
     * @param type Node type
     * @param content Node content
     * @param confidence Confidence score (0-1)
     * @param metadata Additional metadata
     * @returns Created node
     */
    protected addNode(
        graph: ReasoningGraph,
        type: ReasoningNodeType,
        content: string,
        confidence?: number,
        metadata?: Record<string, any>
    ): ReasoningNode {
        const node: ReasoningNode = {
            id: this.generateId(),
            type,
            content,
            confidence,
            timestamp: Date.now(),
            metadata
        };

        graph.nodes.push(node);
        graph.updatedAt = node.timestamp;

        return node;
    }

    /**
     * Add an edge between nodes
     * 
     * @param graph Reasoning graph
     * @param fromNode Source node
     * @param toNode Target node
     * @param label Edge label
     * @param weight Edge weight
     */
    protected addEdge(
        graph: ReasoningGraph,
        fromNode: ReasoningNode,
        toNode: ReasoningNode,
        label?: string,
        weight?: number
    ): void {
        const edge: ReasoningEdge = {
            from: fromNode.id,
            to: toNode.id,
            label,
            weight
        };

        graph.edges.push(edge);
        graph.updatedAt = Date.now();
    }

    /**
     * Create a reasoning step
     * 
     * @param type Step type
     * @param description Step description
     * @param content Step content
     * @param previousStepId Previous step ID
     * @returns Reasoning step
     */
    protected createStep(
        type: ReasoningNodeType,
        description: string,
        content: string,
        previousStepId?: UUID
    ): ReasoningStep {
        return {
            id: this.generateId(),
            type,
            description,
            content,
            previousStepId,
            timestamp: Date.now()
        };
    }

    /**
     * Report progress during reasoning
     * 
     * @param step Current step
     * @param stepNumber Current step number
     * @param totalSteps Total steps performed
     * @param interimConclusion Interim conclusion
     * @param confidence Current confidence
     */
    protected reportProgress(
        step: ReasoningStep,
        stepNumber: number,
        totalSteps: number,
        interimConclusion?: string,
        confidence?: number
    ): void {
        if (this.progressCallback) {
            this.progressCallback({
                currentStep: step,
                stepNumber,
                totalSteps,
                interimConclusion,
                confidence
            });
        }
    }

    /**
     * Generate a unique ID
     * 
     * @returns Unique ID
     */
    protected generateId(): UUID {
        // Simple UUID v4 implementation
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        }) as UUID;
    }
} 