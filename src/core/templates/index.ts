/**
 * Template system for dynamic content generation
 * 
 * This module provides a flexible template system that can be used
 * to generate dynamic content with placeholders that are replaced
 * with actual values at runtime.
 */

// Export data provider interfaces
export {
    ITemplateDataProvider,
    ITemplateDataRegistry,
    TemplateContext
} from './dataProvider';

// Export template registry
export {
    Template,
    TemplateMetadata,
    ITemplateRegistry,
    TemplateRegistry,
    TemplateSelectionOptions
} from './templateRegistry';

// Export template engine
export {
    TemplateEngine,
    TemplateEngineOptions,
    TemplateDataRegistry
} from './templateEngine';

// Import the concrete classes for use in the factory function
import { TemplateDataRegistry } from './templateEngine';
import { TemplateRegistry } from './templateRegistry';
import { TemplateEngine } from './templateEngine';

// Export a convenience function to create a template system
export function createTemplateSystem(logger: any) {
    const dataRegistry = new TemplateDataRegistry({ logger });
    const templateRegistry = new TemplateRegistry({ logger });
    const templateEngine = new TemplateEngine(dataRegistry, { logger });

    return {
        dataRegistry,
        templateRegistry,
        templateEngine
    };
} 