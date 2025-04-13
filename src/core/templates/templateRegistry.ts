import { UUID } from '../../types';

/**
 * Template metadata for organization and selection
 */
export interface TemplateMetadata {
    /**
     * Usage context for this template (e.g., 'greeting', 'response', 'error')
     */
    usage?: string;

    /**
     * Priority for template selection (higher numbers = higher priority)
     */
    priority?: number;

    /**
     * Tags for categorization
     */
    tags?: string[];

    /**
     * Plugin that owns this template
     */
    pluginId?: string;

    /**
     * Additional metadata fields
     */
    [key: string]: any;
}

/**
 * Template definition
 */
export interface Template {
    /**
     * Unique template identifier
     */
    id: string;

    /**
     * Template category
     */
    category: string;

    /**
     * Template content with placeholders
     */
    content: string;

    /**
     * Template metadata
     */
    metadata?: TemplateMetadata;
}

/**
 * Template selection options
 */
export interface TemplateSelectionOptions {
    /**
     * Filter by category
     */
    category?: string;

    /**
     * Filter by usage
     */
    usage?: string;

    /**
     * Filter by tags (must match all)
     */
    tags?: string[];

    /**
     * Filter by plugin ID
     */
    pluginId?: string;

    /**
     * Custom selection function
     */
    selector?: (template: Template) => boolean;
}

/**
 * Registry for templates
 */
export interface ITemplateRegistry {
    /**
     * Register a template
     * @param template The template to register
     * @returns The ID of the registered template
     */
    registerTemplate(template: Template): string;

    /**
     * Register multiple templates
     * @param templates Array of templates to register
     * @returns Array of registered template IDs
     */
    registerTemplates(templates: Template[]): string[];

    /**
     * Get a template by ID
     * @param id Template ID
     * @returns The template or undefined if not found
     */
    getTemplateById(id: string): Template | undefined;

    /**
     * Find templates matching criteria
     * @param options Selection options
     * @returns Array of matching templates
     */
    findTemplates(options: TemplateSelectionOptions): Template[];

    /**
     * Select a single template based on criteria
     * @param options Selection options
     * @returns Best matching template or undefined
     */
    selectTemplate(options: TemplateSelectionOptions): Template | undefined;

    /**
     * Remove a template by ID
     * @param id Template ID
     * @returns true if removed, false if not found
     */
    removeTemplate(id: string): boolean;

    /**
     * Remove all templates for a plugin
     * @param pluginId Plugin ID
     * @returns Number of templates removed
     */
    removePluginTemplates(pluginId: string): number;
}

/**
 * Template registry implementation
 */
export class TemplateRegistry implements ITemplateRegistry {
    private templates: Map<string, Template> = new Map();
    private logger: any;

    constructor(options: { logger: any }) {
        this.logger = options.logger;
    }

    public registerTemplate(template: Template): string {
        if (!template.id) {
            template.id = `template-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        }

        this.templates.set(template.id, template);
        this.logger.debug(`Registered template ${template.id} in category ${template.category}`);
        return template.id;
    }

    public registerTemplates(templates: Template[]): string[] {
        return templates.map(template => this.registerTemplate(template));
    }

    public getTemplateById(id: string): Template | undefined {
        return this.templates.get(id);
    }

    public findTemplates(options: TemplateSelectionOptions): Template[] {
        let results = Array.from(this.templates.values());

        // Apply filters
        if (options.category) {
            results = results.filter(t => t.category === options.category);
        }

        if (options.usage) {
            results = results.filter(t => t.metadata?.usage === options.usage);
        }

        if (options.tags && options.tags.length > 0) {
            results = results.filter(t =>
                options.tags!.every(tag => t.metadata?.tags?.includes(tag))
            );
        }

        if (options.pluginId) {
            results = results.filter(t => t.metadata?.pluginId === options.pluginId);
        }

        if (options.selector) {
            results = results.filter(options.selector);
        }

        return results;
    }

    public selectTemplate(options: TemplateSelectionOptions): Template | undefined {
        const candidates = this.findTemplates(options);

        if (candidates.length === 0) {
            return undefined;
        }

        if (candidates.length === 1) {
            return candidates[0];
        }

        // Sort by priority (higher first)
        return candidates.sort((a, b) =>
            (b.metadata?.priority || 0) - (a.metadata?.priority || 0)
        )[0];
    }

    public removeTemplate(id: string): boolean {
        return this.templates.delete(id);
    }

    public removePluginTemplates(pluginId: string): number {
        let count = 0;

        for (const [id, template] of this.templates.entries()) {
            if (template.metadata?.pluginId === pluginId) {
                this.templates.delete(id);
                count++;
            }
        }

        return count;
    }
} 