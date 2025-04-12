import { describe, expect, test, vi, beforeEach } from 'vitest';
import { EvaluationManager } from '../evaluationManager';
import { processTemplate, parseJsonArrayFromText } from '../evaluationUtils';

// Mock LLM service
const mockLLMService = {
    generateText: vi.fn()
};

describe('EvaluationManager', () => {
    let evaluationManager: EvaluationManager;

    beforeEach(() => {
        evaluationManager = new EvaluationManager(mockLLMService);
        vi.clearAllMocks();
    });

    test('registers and retrieves evaluators', () => {
        // Arrange
        const mockValidator = async () => true;
        const mockHandler = async () => ({ score: 8 });

        // Act
        const evaluator = evaluationManager.registerEvaluator(
            'TestEvaluator',
            'A test evaluator',
            mockValidator,
            mockHandler,
            {
                similes: ['Test evaluation', 'Quality check'],
                examples: []
            }
        );

        // Assert
        expect(evaluator.name).toBe('TestEvaluator');
        expect(evaluator.description).toBe('A test evaluator');

        // Verify we can retrieve it
        const evaluators = evaluationManager.getEvaluators();
        expect(evaluators).toHaveLength(1);
        expect(evaluators[0].name).toBe('TestEvaluator');

        // Verify we can get by ID
        const retrieved = evaluationManager.getEvaluator(evaluator.id);
        expect(retrieved).toBeDefined();
        expect(retrieved?.name).toBe('TestEvaluator');
    });

    test('unregisters evaluators', () => {
        // Arrange
        const mockValidator = async () => true;
        const mockHandler = async () => ({ score: 8 });
        const evaluator = evaluationManager.registerEvaluator(
            'TestEvaluator',
            'A test evaluator',
            mockValidator,
            mockHandler
        );

        // Act
        const result = evaluationManager.unregisterEvaluator(evaluator.id);

        // Assert
        expect(result).toBe(true);
        expect(evaluationManager.getEvaluators()).toHaveLength(0);
        expect(evaluationManager.getEvaluator(evaluator.id)).toBeUndefined();
    });

    test('evaluates if message needs response', async () => {
        // Arrange
        mockLLMService.generateText.mockResolvedValue('true');
        const message = {
            content: { text: 'Hello, can you help me?' },
            sender: 'user123'
        };

        // Act
        const result = await evaluationManager.evaluateNeedsResponse(message);

        // Assert
        expect(result).toBe(true);
        expect(mockLLMService.generateText).toHaveBeenCalled();
    });

    test('runs specific evaluator', async () => {
        // Arrange
        const mockValidator = vi.fn().mockResolvedValue(true);
        const mockHandler = vi.fn().mockResolvedValue({ score: 9, reasons: ['Good response'] });
        const evaluator = evaluationManager.registerEvaluator(
            'QualityEvaluator',
            'Evaluates response quality',
            mockValidator,
            mockHandler
        );

        // Act
        const result = await evaluationManager.runEvaluator(evaluator.id, {
            message: 'How can I help?',
            response: 'I can assist with many tasks.'
        });

        // Assert
        expect(result.evaluatorId).toBe(evaluator.id);
        expect(result.evaluatorName).toBe('QualityEvaluator');
        expect(result.success).toBe(true);
        expect(mockValidator).toHaveBeenCalled();
        expect(mockHandler).toHaveBeenCalled();
    });

    test('template processor replaces placeholders', () => {
        // Arrange
        const template = 'Hello {{user.name}}, your score is {{score}}.';
        const context = {
            user: { name: 'John' },
            score: 95
        };

        // Act
        const result = processTemplate(template, context);

        // Assert
        expect(result).toBe('Hello John, your score is 95.');
    });

    test('parseJsonArrayFromText extracts arrays', () => {
        // Test valid JSON array
        expect(parseJsonArrayFromText('["one", "two", "three"]')).toEqual(['one', 'two', 'three']);

        // Test array embedded in text
        expect(parseJsonArrayFromText('The result is ["alpha", "beta"] based on analysis.')).toEqual(['alpha', 'beta']);

        // Test invalid JSON
        expect(parseJsonArrayFromText('Not an array')).toBeNull();
    });
}); 