/**
 * Prompt Builder for neucore
 * 
 * This module provides tools to construct structured prompts with context,
 * relevant files, and other metadata using XML-like markup.
 */

import { StandardTags } from './textPreprocessor';

/**
 * File context information
 */
export interface FileContext {
    /**
     * Path to the file
     */
    path: string;

    /**
     * Content of the file
     */
    content?: string;

    /**
     * Current line number
     */
    line?: number;

    /**
     * Content of the current line
     */
    lineContent?: string;

    /**
     * Line range for partial file content
     */
    lineRange?: [number, number];

    /**
     * Selection information
     */
    selection?: {
        startLine: number;
        endLine: number;
        content: string;
    };
}

/**
 * Linter error information
 */
export interface LinterError {
    /**
     * File path
     */
    file: string;

    /**
     * Line number
     */
    line: number;

    /**
     * Error message
     */
    message: string;

    /**
     * Error severity (0=info, 1=warning, 2=error)
     */
    severity: number;
}

/**
 * Options for the prompt builder
 */
export interface PromptBuilderOptions {
    /**
     * Maximum length for the entire prompt in characters
     */
    maxLength?: number;

    /**
     * Relevance threshold for including context (0-1)
     */
    relevanceThreshold?: number;

    /**
     * Whether to include line numbers
     */
    includeLineNumbers?: boolean;

    /**
     * Whether to normalize whitespace
     */
    normalizeWhitespace?: boolean;

    /**
     * Maximum number of files to include
     */
    maxFiles?: number;

    /**
     * Maximum number of errors to include
     */
    maxErrors?: number;
}

/**
 * Structure of a built prompt
 */
export interface StructuredPrompt {
    /**
     * User's query or question
     */
    userQuery: string;

    /**
     * Custom instructions for the AI
     */
    customInstructions?: string;

    /**
     * Summary of previous conversation
     */
    conversationSummary?: string;

    /**
     * Additional contextual data
     */
    additionalData?: {
        /**
         * Current files (what the user is viewing)
         */
        currentFile?: FileContext[];

        /**
         * Additional files for context
         */
        attachedFiles?: FileContext[];

        /**
         * Linter errors in the workspace
         */
        linterErrors?: {
            file: string;
            errors: {
                line: number;
                message: string;
                severity: number;
            }[];
        }[];

        /**
         * Terminal output
         */
        terminalOutput?: string;
    };
}

/**
 * Builder for structured prompts
 */
export class PromptBuilder {
    private userQuery: string = '';
    private customInstructions: string | undefined;
    private conversationSummary: string | undefined;
    private currentFiles: FileContext[] = [];
    private attachedFiles: FileContext[] = [];
    private linterErrors: LinterError[] = [];
    private terminalOutput: string | undefined;
    private options: PromptBuilderOptions;

    /**
     * Create a new prompt builder
     * @param options Options for the builder
     */
    constructor(options: PromptBuilderOptions = {}) {
        this.options = {
            maxLength: 100000,
            relevanceThreshold: 0.3,
            includeLineNumbers: true,
            normalizeWhitespace: true,
            maxFiles: 10,
            maxErrors: 20,
            ...options
        };
    }

    /**
     * Add the user's query
     * @param query User's query text
     */
    withUserQuery(query: string): this {
        this.userQuery = query;
        return this;
    }

    /**
     * Add custom instructions for the AI
     * @param instructions Custom instructions text
     */
    withCustomInstructions(instructions: string): this {
        this.customInstructions = instructions;
        return this;
    }

    /**
     * Add conversation summary
     * @param summary Summary of previous conversation
     */
    withConversationSummary(summary: string): this {
        this.conversationSummary = summary;
        return this;
    }

    /**
     * Add a current file (what the user is viewing/editing)
     * @param file File context object
     */
    withCurrentFile(file: FileContext): this {
        this.currentFiles.push(file);
        return this;
    }

    /**
     * Add an attached file for additional context
     * @param file File context object
     */
    withAttachedFile(file: FileContext): this {
        this.attachedFiles.push(file);
        return this;
    }

    /**
     * Add linter errors
     * @param errors Array of linter errors
     */
    withLinterErrors(errors: LinterError[]): this {
        this.linterErrors.push(...errors);
        return this;
    }

    /**
     * Add terminal output
     * @param output Terminal output text
     */
    withTerminalOutput(output: string): this {
        this.terminalOutput = output;
        return this;
    }

    /**
     * Set the relevance threshold for including context
     * @param threshold Threshold value (0-1)
     */
    withRelevanceThreshold(threshold: number): this {
        this.options.relevanceThreshold = Math.max(0, Math.min(1, threshold));
        return this;
    }

    /**
     * Set the maximum context length
     * @param maxLength Maximum length in characters
     */
    withMaxContextLength(maxLength: number): this {
        this.options.maxLength = maxLength;
        return this;
    }

    /**
     * Build the structured prompt object
     */
    build(): StructuredPrompt {
        if (!this.userQuery) {
            throw new Error('User query is required');
        }

        const prompt: StructuredPrompt = {
            userQuery: this.userQuery
        };

        if (this.customInstructions) {
            prompt.customInstructions = this.customInstructions;
        }

        if (this.conversationSummary) {
            prompt.conversationSummary = this.conversationSummary;
        }

        // Add additional data if any exists
        if (this.currentFiles.length > 0 ||
            this.attachedFiles.length > 0 ||
            this.linterErrors.length > 0 ||
            this.terminalOutput) {

            prompt.additionalData = {};

            // Add current files
            if (this.currentFiles.length > 0) {
                prompt.additionalData.currentFile = this.currentFiles;
            }

            // Add attached files (limit by max files)
            if (this.attachedFiles.length > 0) {
                const limitedFiles = this.attachedFiles.slice(0, this.options.maxFiles);
                prompt.additionalData.attachedFiles = limitedFiles;
            }

            // Add linter errors (group by file)
            if (this.linterErrors.length > 0) {
                const errorsByFile: Record<string, LinterError[]> = {};

                // Group errors by file
                for (const error of this.linterErrors) {
                    if (!errorsByFile[error.file]) {
                        errorsByFile[error.file] = [];
                    }
                    errorsByFile[error.file].push(error);
                }

                // Create the structured format
                const fileErrors = Object.entries(errorsByFile).map(([file, errors]) => ({
                    file,
                    errors: errors.slice(0, this.options.maxErrors).map(e => ({
                        line: e.line,
                        message: e.message,
                        severity: e.severity
                    }))
                }));

                prompt.additionalData.linterErrors = fileErrors;
            }

            // Add terminal output
            if (this.terminalOutput) {
                prompt.additionalData.terminalOutput = this.terminalOutput;
            }
        }

        return prompt;
    }

    /**
     * Serialize the prompt to the XML-like string format
     */
    serialize(): string {
        const prompt = this.build();
        let result = '';

        // Add custom instructions
        if (prompt.customInstructions) {
            result += `<${StandardTags.CUSTOM_INSTRUCTIONS}>\n${prompt.customInstructions}\n</${StandardTags.CUSTOM_INSTRUCTIONS}>\n\n`;
        }

        // Add conversation summary
        if (prompt.conversationSummary) {
            result += `<${StandardTags.CONVERSATION_SUMMARY}>\n${prompt.conversationSummary}\n</${StandardTags.CONVERSATION_SUMMARY}>\n\n`;
        }

        // Add additional data section
        if (prompt.additionalData) {
            result += `<${StandardTags.ADDITIONAL_DATA}>\nBelow are some potentially helpful/relevant pieces of information for figuring out how to respond\n\n`;

            // Add current files
            if (prompt.additionalData.currentFile && prompt.additionalData.currentFile.length > 0) {
                for (const file of prompt.additionalData.currentFile) {
                    result += `<${StandardTags.CURRENT_FILE}>\n`;
                    result += `Path: ${file.path}\n`;

                    if (file.line !== undefined) {
                        result += `Line: ${file.line}\n`;
                    }

                    if (file.lineContent) {
                        result += `Line Content: \`${file.lineContent}\`\n`;
                    }

                    if (file.selection) {
                        result += `Selection: lines ${file.selection.startLine}-${file.selection.endLine}\n`;
                        result += `\`\`\`\n${file.selection.content}\n\`\`\`\n`;
                    }

                    result += `</${StandardTags.CURRENT_FILE}>\n\n`;
                }
            }

            // Add attached files
            if (prompt.additionalData.attachedFiles && prompt.additionalData.attachedFiles.length > 0) {
                result += `<${StandardTags.ATTACHED_FILES}>\n`;

                for (const file of prompt.additionalData.attachedFiles) {
                    result += `<${StandardTags.FILE_CONTENTS}>\n`;

                    const lineInfo = file.lineRange ? `, lines=${file.lineRange[0]}-${file.lineRange[1]}` : '';
                    result += `\`\`\`path=${file.path}${lineInfo}\n`;

                    if (file.content) {
                        result += file.content;
                    }

                    result += `\n\`\`\`\n`;
                    result += `</${StandardTags.FILE_CONTENTS}>\n`;
                }

                result += `</${StandardTags.ATTACHED_FILES}>\n\n`;
            }

            // Add linter errors
            if (prompt.additionalData.linterErrors && prompt.additionalData.linterErrors.length > 0) {
                for (const fileError of prompt.additionalData.linterErrors) {
                    result += `<${StandardTags.LINTER_ERRORS}>\n`;
                    result += `File: ${fileError.file}\n`;

                    for (const error of fileError.errors) {
                        const severityLabel = error.severity === 2 ? 'error' : error.severity === 1 ? 'warning' : 'info';
                        result += `Line ${error.line}: ${error.message} (${severityLabel})\n`;
                    }

                    result += `</${StandardTags.LINTER_ERRORS}>\n\n`;
                }
            }

            // Add terminal output
            if (prompt.additionalData.terminalOutput) {
                result += `<${StandardTags.TERMINAL_OUTPUT}>\n${prompt.additionalData.terminalOutput}\n</${StandardTags.TERMINAL_OUTPUT}>\n\n`;
            }

            result += `</${StandardTags.ADDITIONAL_DATA}>\n\n`;
        }

        // Add user query
        result += `<${StandardTags.USER_QUERY}>\n${prompt.userQuery}\n</${StandardTags.USER_QUERY}>\n`;

        return result;
    }

    /**
     * Serialize the prompt to JSON
     */
    toJSON(): string {
        return JSON.stringify(this.build(), null, 2);
    }
}

/**
 * Factory function to create a prompt builder with default options
 */
export function createPromptBuilder(options?: PromptBuilderOptions): PromptBuilder {
    return new PromptBuilder(options);
} 