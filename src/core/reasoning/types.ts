/**
 * Reasoning System Types for NeuroCore
 * 
 * This module defines the types for structured reasoning processes
 * that enhance decision-making and planning capabilities.
 */

import { UUID } from '../../types';

/**
 * Reasoning method types
 */
export enum ReasoningMethod {
    /**
     * Chain of Thought: Step-by-step reasoning process
     */
    CHAIN_OF_THOUGHT = 'chain_of_thought',

    /**
     * Tree of Thought: Exploring multiple reasoning paths
     */
    TREE_OF_THOUGHT = 'tree_of_thought',

    /**
     * ReAct: Reasoning and Acting in an alternating sequence
     */
    REACT = 'react',

    /**
     * Socratic Method: Query-based reasoning through questions
     */
    SOCRATIC = 'socratic',

    /**
     * First Principles: Breaking down problems to fundamental elements
     */
    FIRST_PRINCIPLES = 'first_principles',

    /**
     * Reflexion: Self-critical reasoning with reflection
     */
    REFLEXION = 'reflexion'
}

/**
 * Types of reasoning nodes in a reasoning process
 */
export enum ReasoningNodeType {
    /**
     * Observation of facts or data
     */
    OBSERVATION = 'observation',

    /**
     * Analysis of information
     */
    ANALYSIS = 'analysis',

    /**
     * Inference or conclusion
     */
    INFERENCE = 'inference',

    /**
     * Action to take based on reasoning
     */
    ACTION = 'action',

    /**
     * Question to explore
     */
    QUESTION = 'question',

    /**
     * Decision point or choice
     */
    DECISION = 'decision',

    /**
     * Reflection on previous steps
     */
    REFLECTION = 'reflection'
}

/**
 * Reasoning node in a reasoning graph
 */
export interface ReasoningNode {
    /**
     * Unique identifier for the node
     */
    id: UUID;

    /**
     * Type of reasoning node
     */
    type: ReasoningNodeType;

    /**
     * Content of the node
     */
    content: string;

    /**
     * Confidence score (0-1)
     */
    confidence?: number;

    /**
     * Creation timestamp
     */
    timestamp: number;

    /**
     * Additional metadata
     */
    metadata?: Record<string, any>;
}

/**
 * Edge connecting reasoning nodes
 */
export interface ReasoningEdge {
    /**
     * Source node ID
     */
    from: UUID;

    /**
     * Target node ID
     */
    to: UUID;

    /**
     * Edge label or relationship type
     */
    label?: string;

    /**
     * Edge weight (strength of connection)
     */
    weight?: number;
}

/**
 * Reasoning graph representing a reasoning process
 */
export interface ReasoningGraph {
    /**
     * Unique identifier
     */
    id: UUID;

    /**
     * Nodes in the reasoning graph
     */
    nodes: ReasoningNode[];

    /**
     * Edges connecting nodes
     */
    edges: ReasoningEdge[];

    /**
     * Reasoning method used
     */
    method: ReasoningMethod;

    /**
     * Initial query or problem statement
     */
    query: string;

    /**
     * Final conclusion or result, if available
     */
    conclusion?: string;

    /**
     * Creation timestamp
     */
    createdAt: number;

    /**
     * Last update timestamp
     */
    updatedAt: number;

    /**
     * Additional metadata
     */
    metadata?: Record<string, any>;
}

/**
 * A step in a reasoning process
 */
export interface ReasoningStep {
    /**
     * Unique identifier
     */
    id: UUID;

    /**
     * Step description
     */
    description: string;

    /**
     * Step content/output
     */
    content: string;

    /**
     * Step type
     */
    type: ReasoningNodeType;

    /**
     * Previous step ID
     */
    previousStepId?: UUID;

    /**
     * Next step IDs (for branching)
     */
    nextStepIds?: UUID[];

    /**
     * Creation timestamp
     */
    timestamp: number;
}

/**
 * Options for a reasoning process
 */
export interface ReasoningOptions {
    /**
     * Reasoning method to use
     */
    method: ReasoningMethod;

    /**
     * Maximum depth of reasoning (steps)
     */
    maxDepth?: number;

    /**
     * Maximum branches for tree-based methods
     */
    maxBranches?: number;

    /**
     * Whether to allow background knowledge
     */
    useBackgroundKnowledge?: boolean;

    /**
     * Temperature for generation (0-2)
     */
    temperature?: number;

    /**
     * Enable self-reflection at each step
     */
    enableReflection?: boolean;

    /**
     * Maximum number of iterations
     */
    maxIterations?: number;

    /**
     * Stop reasoning when confidence exceeds this threshold
     */
    confidenceThreshold?: number;

    /**
     * Additional method-specific options
     */
    methodOptions?: Record<string, any>;
} 