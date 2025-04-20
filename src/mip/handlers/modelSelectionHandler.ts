import { ModelSelectionDecisionTree } from '../features/modelSelection/decisionTree';
import {
    ModelSelectionCriteria,
    ModelSelectionResult,
    TaskType,
    ClassificationType,
    GenerationType,
    EmbeddingType
} from '../types/modelSelection';
import { ModelRegistry } from '../registry/modelRegistry';

/**
 * Internal utility class for model selection
 * @private Not for public use. Use the ModelSelectionPlugin instead.
 */
export class ModelSelectionHandler {
    private decisionTree: ModelSelectionDecisionTree;
    private modelRegistry: ModelRegistry;

    constructor(modelRegistry: ModelRegistry) {
        this.modelRegistry = modelRegistry;
        this.decisionTree = new ModelSelectionDecisionTree(this.modelRegistry);
    }

    /**
     * Validate model selection criteria
     * @param criteria The criteria to validate
     * @returns ValidationResult with success status and optional error message
     */
    private validateCriteria(criteria: ModelSelectionCriteria): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        // Check if criteria is defined
        if (!criteria) {
            return { valid: false, errors: ['Criteria object is required'] };
        }

        // Check required fields
        if (!criteria.taskType) {
            errors.push('taskType is required');
        } else if (!this.isValidTaskType(criteria.taskType)) {
            errors.push(`Invalid taskType: ${criteria.taskType}. Must be one of: classification, generation, embedding`);
        }

        // Validate task-specific requirements
        if (criteria.taskType === 'classification' &&
            criteria.specificRequirements?.classificationType &&
            !this.isValidClassificationType(criteria.specificRequirements.classificationType)) {
            errors.push(`Invalid classificationType: ${criteria.specificRequirements.classificationType}. Must be one of: binary, multi-class`);
        }

        if (criteria.taskType === 'generation' &&
            criteria.specificRequirements?.generationType &&
            !this.isValidGenerationType(criteria.specificRequirements.generationType)) {
            errors.push(`Invalid generationType: ${criteria.specificRequirements.generationType}. Must be one of: short, long, creative, factual`);
        }

        if (criteria.taskType === 'embedding' &&
            criteria.specificRequirements?.embeddingType &&
            !this.isValidEmbeddingType(criteria.specificRequirements.embeddingType)) {
            errors.push(`Invalid embeddingType: ${criteria.specificRequirements.embeddingType}. Must be one of: semantic, contextual`);
        }

        // Validate performance requirements
        if (criteria.performanceRequirements) {
            const { maxLatency, minQuality, maxCost } = criteria.performanceRequirements;

            if (maxLatency !== undefined && (typeof maxLatency !== 'number' || maxLatency <= 0)) {
                errors.push('maxLatency must be a positive number');
            }

            if (minQuality !== undefined && (typeof minQuality !== 'number' || minQuality < 0 || minQuality > 1)) {
                errors.push('minQuality must be a number between 0 and 1');
            }

            if (maxCost !== undefined && (typeof maxCost !== 'number' || maxCost <= 0)) {
                errors.push('maxCost must be a positive number');
            }
        }

        // Validate data characteristics
        if (criteria.dataCharacteristics) {
            const { textLength, complexity } = criteria.dataCharacteristics;

            if (textLength !== undefined && (typeof textLength !== 'number' || textLength < 0)) {
                errors.push('textLength must be a non-negative number');
            }

            if (complexity && !['low', 'medium', 'high'].includes(complexity)) {
                errors.push('complexity must be one of: low, medium, high');
            }
        }

        // Check for invalid dimensionality
        if (criteria.specificRequirements?.dimensionality !== undefined) {
            const dim = criteria.specificRequirements.dimensionality;
            if (typeof dim !== 'number' || dim <= 0 || !Number.isInteger(dim)) {
                errors.push('dimensionality must be a positive integer');
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Type guard for TaskType
     */
    private isValidTaskType(type: string): type is TaskType {
        return ['classification', 'generation', 'embedding'].includes(type);
    }

    /**
     * Type guard for ClassificationType
     */
    private isValidClassificationType(type: string): type is ClassificationType {
        return ['binary', 'multi-class'].includes(type);
    }

    /**
     * Type guard for GenerationType
     */
    private isValidGenerationType(type: string): type is GenerationType {
        return ['short', 'long', 'creative', 'factual'].includes(type);
    }

    /**
     * Type guard for EmbeddingType
     */
    private isValidEmbeddingType(type: string): type is EmbeddingType {
        return ['semantic', 'contextual'].includes(type);
    }

    /**
     * Select a model based on the given criteria
     * @param criteria The selection criteria
     */
    public selectModel(criteria: ModelSelectionCriteria): ModelSelectionResult {
        // Validate criteria before selection
        const validation = this.validateCriteria(criteria);
        if (!validation.valid) {
            throw new Error(`Invalid criteria: ${validation.errors.join(', ')}`);
        }

        try {
            return this.decisionTree.selectModel(criteria);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            throw new Error(`Model selection failed: ${errorMessage}`);
        }
    }
} 