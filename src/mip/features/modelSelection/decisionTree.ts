import { AIModel, DecisionNode, ModelSelectionCriteria, ModelSelectionResult } from '../../types/modelSelection';
import { ModelRegistry } from '../../registry/modelRegistry';

export class ModelSelectionDecisionTree {
    private root: DecisionNode;
    private defaultModel: ModelSelectionResult;
    private modelRegistry: ModelRegistry;

    constructor(modelRegistry: ModelRegistry) {
        this.modelRegistry = modelRegistry;
        this.root = this.buildDecisionTree();
        this.defaultModel = this.createDefaultModel();
    }

    private buildDecisionTree(): DecisionNode {
        return {
            id: 'root',
            type: 'decision',
            criteria: (criteria) => true,
            children: [
                // Classification branch
                {
                    id: 'classification',
                    type: 'decision',
                    criteria: (criteria) => criteria.taskType === 'classification',
                    children: [
                        {
                            id: 'binary-classification',
                            type: 'decision',
                            criteria: (criteria) => criteria.specificRequirements?.classificationType === 'binary',
                            children: [
                                this.createModelSelectionNode('classification', { classificationType: 'binary' })
                            ]
                        },
                        {
                            id: 'multi-class-classification',
                            type: 'decision',
                            criteria: (criteria) => criteria.specificRequirements?.classificationType === 'multi-class',
                            children: [
                                this.createModelSelectionNode('classification', { classificationType: 'multi-class' })
                            ]
                        },
                        // Fallback for classification with no specific type
                        {
                            id: 'classification-fallback',
                            type: 'decision',
                            criteria: () => true,
                            children: [
                                this.createModelSelectionNode('classification')
                            ]
                        }
                    ]
                },
                // Generation branch
                {
                    id: 'generation',
                    type: 'decision',
                    criteria: (criteria) => criteria.taskType === 'generation',
                    children: [
                        {
                            id: 'short-generation',
                            type: 'decision',
                            criteria: (criteria) => criteria.specificRequirements?.generationType === 'short',
                            children: [
                                this.createModelSelectionNode('generation', { generationType: 'short' })
                            ]
                        },
                        {
                            id: 'long-generation',
                            type: 'decision',
                            criteria: (criteria) => criteria.specificRequirements?.generationType === 'long',
                            children: [
                                this.createModelSelectionNode('generation', { generationType: 'long' })
                            ]
                        },
                        // Fallback for generation with no specific type
                        {
                            id: 'generation-fallback',
                            type: 'decision',
                            criteria: () => true,
                            children: [
                                this.createModelSelectionNode('generation')
                            ]
                        }
                    ]
                },
                // Embedding branch
                {
                    id: 'embedding',
                    type: 'decision',
                    criteria: (criteria) => criteria.taskType === 'embedding',
                    children: [
                        {
                            id: 'semantic-embedding',
                            type: 'decision',
                            criteria: (criteria) => criteria.specificRequirements?.embeddingType === 'semantic',
                            children: [
                                this.createModelSelectionNode('embedding', { embeddingType: 'semantic' })
                            ]
                        },
                        {
                            id: 'contextual-embedding',
                            type: 'decision',
                            criteria: (criteria) => criteria.specificRequirements?.embeddingType === 'contextual',
                            children: [
                                this.createModelSelectionNode('embedding', { embeddingType: 'contextual' })
                            ]
                        },
                        // Fallback for embedding with no specific type
                        {
                            id: 'embedding-fallback',
                            type: 'decision',
                            criteria: () => true,
                            children: [
                                this.createModelSelectionNode('embedding')
                            ]
                        }
                    ]
                },
                // Root fallback for unknown task types
                {
                    id: 'root-fallback',
                    type: 'result',
                    result: this.defaultModel
                }
            ]
        };
    }

    private createModelSelectionNode(
        taskType: string,
        specificRequirements?: {
            classificationType?: string;
            generationType?: string;
            embeddingType?: string;
        }
    ): DecisionNode {
        return {
            id: `${taskType}${specificRequirements ? '-' + Object.values(specificRequirements).join('-') : ''}-selector`,
            type: 'decision',
            criteria: () => true,
            // This node will use actual model selection based on criteria at runtime
            // rather than having hardcoded results
            children: [
                {
                    id: `${taskType}-model-lookup`,
                    type: 'decision',
                    criteria: () => true,
                    // This is a special node that will be handled in traverseTree
                    // It's marked with a special ID that includes 'model-lookup'
                }
            ]
        };
    }

    private createDefaultModel(): ModelSelectionResult {
        // Try to get a reasonable default model from the registry
        const generalModels = this.modelRegistry.findModels({
            taskType: 'generation'  // Most versatile task type
        });

        if (generalModels.length > 0) {
            return this.convertModelToResult(generalModels[0], [
                'Using default model as no specific criteria matched',
                `Selected ${generalModels[0].name} as it's a versatile model`
            ]);
        }

        // Fallback default if no models in registry
        return {
            selectedModel: 'general-purpose-model',
            confidence: 0.6,
            reasoning: ['Using default model as no specific criteria matched'],
            alternatives: ['specialized-model'],
            metadata: {
                provider: 'default',
                capabilities: ['general-purpose'],
                performanceMetrics: {
                    latency: 150,
                    quality: 0.8,
                    costPerToken: 0.00001
                }
            }
        };
    }

    private convertModelToResult(model: AIModel, reasoning: string[] = []): ModelSelectionResult {
        // Find alternative models from the same provider with similar capabilities
        const alternatives = this.modelRegistry.getAllModels()
            .filter(m =>
                m.id !== model.id &&
                m.provider === model.provider &&
                m.capabilities.tasks.some(task => model.capabilities.tasks.includes(task))
            )
            .map(m => m.id);

        return {
            selectedModel: model.id,
            confidence: 0.9,
            reasoning: reasoning.length > 0 ? reasoning : [
                `Selected ${model.name} based on criteria`,
                `Model provides ${model.performanceMetrics.quality.toFixed(2)} quality score`
            ],
            alternatives: alternatives.slice(0, 3), // Limit to 3 alternatives
            metadata: {
                provider: model.provider,
                capabilities: [
                    ...model.capabilities.tasks,
                    ...(model.capabilities.classificationTypes || []),
                    ...(model.capabilities.generationTypes || []),
                    ...(model.capabilities.embeddingTypes || [])
                ],
                performanceMetrics: {
                    latency: model.performanceMetrics.latency,
                    quality: model.performanceMetrics.quality,
                    costPerToken: model.performanceMetrics.costPerToken,
                    throughput: model.performanceMetrics.throughput || 0,
                    contextWindow: model.contextWindow
                }
            }
        };
    }

    public selectModel(criteria: ModelSelectionCriteria): ModelSelectionResult {
        return this.traverseTree(this.root, criteria);
    }

    private traverseTree(node: DecisionNode, criteria: ModelSelectionCriteria): ModelSelectionResult {
        // Handle model lookup nodes - this is where we query the registry
        if (node.id && node.id.includes('model-lookup')) {
            return this.lookupModelsForCriteria(criteria);
        }

        // If this is a result node, return its result
        if (node.type === 'result' && node.result) {
            // Check if this result node has its own criteria function
            if (node.criteria && !node.criteria(criteria)) {
                // This result node doesn't match the criteria, continue searching
            } else {
                // Result node matches criteria (or has no criteria function)
                return node.result;
            }
        }

        if (node.children) {
            // First, collect all matching children
            const matchingChildren: DecisionNode[] = [];
            for (const child of node.children) {
                if (child.criteria && child.criteria(criteria)) {
                    matchingChildren.push(child);
                }
            }

            // If we found matching children, try the most specific match first
            if (matchingChildren.length > 0) {
                // Sort by node ID specificity - longer IDs are typically more specific
                matchingChildren.sort((a, b) => b.id.length - a.id.length);

                for (const child of matchingChildren) {
                    try {
                        return this.traverseTree(child, criteria);
                    } catch (error) {
                        // If a branch fails, try the next one
                        continue;
                    }
                }
            }

            // No matching children or none returned a valid result
            // Look for appropriate fallback nodes
            const fallbacks: DecisionNode[] = [];

            // First priority: task-specific fallbacks
            if (criteria.taskType) {
                const taskSpecificFallback = node.children.find(child =>
                    child.id.includes(`${criteria.taskType}-fallback`));
                if (taskSpecificFallback) {
                    fallbacks.push(taskSpecificFallback);
                }
            }

            // Second priority: generic fallbacks
            const genericFallback = node.children.find(child =>
                child.id.includes('fallback') && !child.id.includes('-fallback'));
            if (genericFallback) {
                fallbacks.push(genericFallback);
            }

            // Try all collected fallbacks
            for (const fallback of fallbacks) {
                try {
                    return this.traverseTree(fallback, criteria);
                } catch (error) {
                    // If a fallback fails, try the next one
                    continue;
                }
            }
        }

        // Nothing worked, return the global default model
        return this.defaultModel;
    }

    private lookupModelsForCriteria(criteria: ModelSelectionCriteria): ModelSelectionResult {
        // Find models that match the given criteria
        const matchingModels = this.modelRegistry.findModels(criteria);

        if (matchingModels.length === 0) {
            throw new Error(`No matching models found for criteria: ${JSON.stringify(criteria)}`);
        }

        // The models are already sorted by quality and latency in the registry
        const bestModel = matchingModels[0];

        // Generate reasoning based on why this model was selected
        const reasoning: string[] = [
            `Selected ${bestModel.name} (${bestModel.provider}) as the best match for criteria`,
        ];

        // Add reasoning about performance requirements if specified
        if (criteria.performanceRequirements) {
            if (criteria.performanceRequirements.maxLatency) {
                reasoning.push(`Model meets latency requirement: ${bestModel.performanceMetrics.latency}ms vs required ${criteria.performanceRequirements.maxLatency}ms`);
            }

            if (criteria.performanceRequirements.minQuality) {
                reasoning.push(`Model meets quality requirement: ${bestModel.performanceMetrics.quality.toFixed(2)} vs required ${criteria.performanceRequirements.minQuality.toFixed(2)}`);
            }

            if (criteria.performanceRequirements.maxCost) {
                const modelCost = bestModel.performanceMetrics.costPerToken * 1000;
                reasoning.push(`Model meets cost requirement: $${modelCost.toFixed(5)} per 1K tokens vs max $${criteria.performanceRequirements.maxCost.toFixed(5)}`);
            }
        }

        // Add specific task capabilities
        const specificCapabilities: string[] = [];

        if (criteria.taskType === 'classification' && criteria.specificRequirements?.classificationType) {
            specificCapabilities.push(`${criteria.specificRequirements.classificationType} classification`);
        }

        if (criteria.taskType === 'generation' && criteria.specificRequirements?.generationType) {
            specificCapabilities.push(`${criteria.specificRequirements.generationType} text generation`);
        }

        if (criteria.taskType === 'embedding' && criteria.specificRequirements?.embeddingType) {
            specificCapabilities.push(`${criteria.specificRequirements.embeddingType} embeddings`);
        }

        if (specificCapabilities.length > 0) {
            reasoning.push(`Model supports required capabilities: ${specificCapabilities.join(', ')}`);
        }

        // If we have alternatives, mention how many other options were considered
        if (matchingModels.length > 1) {
            reasoning.push(`Selected from ${matchingModels.length} matching models based on optimal performance characteristics`);
        }

        return this.convertModelToResult(bestModel, reasoning);
    }
} 