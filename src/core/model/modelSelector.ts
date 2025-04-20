import { IModelProvider } from '../providers/modelProvider';

export interface ModelSelectionCriteria {
    taskType?: string;
    requiredCapabilities?: string[];
    performanceThresholds?: {
        maxLatency?: number;
        minQuality?: number;
        maxCost?: number;
    };
    providerPreferences?: string[];
}

export interface ModelSelectionResult {
    selectedModel: string;
    provider: string;
    confidence: number;
    reasoning: string;
}

export interface ModelSelectionStrategy {
    selectModel(
        providers: IModelProvider[],
        criteria: ModelSelectionCriteria
    ): Promise<ModelSelectionResult>;
}

export class ModelSelector {
    private strategies: Map<string, ModelSelectionStrategy> = new Map();

    constructor() {
        // Register default strategies
        this.registerStrategy('performance', new PerformanceBasedStrategy());
        this.registerStrategy('task-specific', new TaskSpecificStrategy());
    }

    registerStrategy(name: string, strategy: ModelSelectionStrategy): void {
        this.strategies.set(name, strategy);
    }

    async selectModel(
        providers: IModelProvider[],
        criteria: ModelSelectionCriteria,
        strategyName: string = 'performance'
    ): Promise<ModelSelectionResult> {
        const strategy = this.strategies.get(strategyName);
        if (!strategy) {
            throw new Error(`Strategy not found: ${strategyName}`);
        }

        return strategy.selectModel(providers, criteria);
    }
}

class PerformanceBasedStrategy implements ModelSelectionStrategy {
    async selectModel(
        providers: IModelProvider[],
        criteria: ModelSelectionCriteria
    ): Promise<ModelSelectionResult> {
        // TODO: Implement performance-based selection
        return {
            selectedModel: 'default',
            provider: 'default',
            confidence: 1.0,
            reasoning: 'Performance-based selection not yet implemented'
        };
    }
}

class TaskSpecificStrategy implements ModelSelectionStrategy {
    async selectModel(
        providers: IModelProvider[],
        criteria: ModelSelectionCriteria
    ): Promise<ModelSelectionResult> {
        // TODO: Implement task-specific selection
        return {
            selectedModel: 'default',
            provider: 'default',
            confidence: 1.0,
            reasoning: 'Task-specific selection not yet implemented'
        };
    }
} 