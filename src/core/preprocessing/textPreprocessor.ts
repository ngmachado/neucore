/**
 * Text Preprocessor for neucore
 * 
 * This module provides text preprocessing functionality to normalize and
 * extract structured data from user queries using XML-like markup.
 */

/**
 * Options for text preprocessing
 */
export interface TextPreprocessingOptions {
    /**
     * Whether to normalize whitespace (trim, collapse multiple spaces)
     */
    normalizeWhitespace?: boolean;

    /**
     * Whether to extract structured data from XML tags
     */
    parseXmlTags?: boolean;

    /**
     * Whether to remove XML tags from the final text
     */
    stripTags?: boolean;

    /**
     * Custom tags to look for (in addition to standard ones)
     */
    customTags?: string[];

    /**
     * Whether to convert markdown syntax to structured data
     */
    parseMarkdown?: boolean;

    /**
     * Whether to extract metadata from special comments
     */
    extractMetadata?: boolean;
}

/**
 * Standard tags recognized by the preprocessor
 */
export enum StandardTags {
    CONTEXT = 'context',
    QUERY = 'query',
    METADATA = 'metadata',
    INTENT = 'intent',
    CODE = 'code',
    EXAMPLE = 'example',
    REFERENCE = 'reference',
    INSTRUCTION = 'instruction',
    CUSTOM_INSTRUCTIONS = 'custom_instructions',
    ADDITIONAL_DATA = 'additional_data',
    CURRENT_FILE = 'current_file',
    ATTACHED_FILES = 'attached_files',
    FILE_CONTENTS = 'file_contents',
    LINTER_ERRORS = 'linter_errors',
    CONVERSATION_SUMMARY = 'conversation_summary',
    USER_QUERY = 'user_query',
    TERMINAL_OUTPUT = 'terminal_output'
}

/**
 * Result of text preprocessing
 */
export interface PreprocessingResult {
    /**
     * The processed text with any transformations applied
     */
    text: string;

    /**
     * Structured data extracted from the text
     */
    structuredData: Record<string, any>;

    /**
     * Metadata about the preprocessing
     */
    metadata: {
        originalLength: number;
        processedLength: number;
        extractedTags: string[];
        detectedLanguages?: string[];
        processingTime: number;
    };
}

/**
 * Text preprocessor for user queries
 */
export class TextPreprocessor {
    private options: TextPreprocessingOptions;

    /**
     * Create a new text preprocessor
     * @param options Preprocessing options
     */
    constructor(options: TextPreprocessingOptions = {}) {
        this.options = {
            normalizeWhitespace: true,
            parseXmlTags: true,
            stripTags: false,
            parseMarkdown: true,
            extractMetadata: true,
            ...options
        };
    }

    /**
     * Process text according to configured options
     * @param text Input text to process
     * @returns Processed text and extracted data
     */
    process(text: string): PreprocessingResult {
        const startTime = Date.now();
        const originalLength = text.length;

        // Initialize result
        let processedText = text;
        const structuredData: Record<string, any> = {};
        const extractedTags: string[] = [];

        // Step 1: Normalize whitespace if enabled
        if (this.options.normalizeWhitespace) {
            processedText = this.normalizeWhitespace(processedText);
        }

        // Step 2: Parse XML tags if enabled
        if (this.options.parseXmlTags) {
            const parsingResult = this.parseXmlTags(processedText);
            structuredData.tags = parsingResult.data;
            extractedTags.push(...parsingResult.foundTags);

            if (this.options.stripTags) {
                processedText = parsingResult.textWithoutTags;
            } else {
                processedText = parsingResult.text;
            }
        }

        // Step 3: Parse markdown if enabled
        if (this.options.parseMarkdown) {
            const markdownResult = this.parseMarkdown(processedText);
            structuredData.markdown = markdownResult.data;
            processedText = markdownResult.text;
        }

        // Step 4: Extract metadata from special comments if enabled
        if (this.options.extractMetadata) {
            const metadataResult = this.extractMetadata(processedText);
            structuredData.metadata = metadataResult.metadata;
            processedText = metadataResult.text;
        }

        // Compute final metadata
        const processedLength = processedText.length;
        const processingTime = Date.now() - startTime;

        // Detect languages in code blocks
        const detectedLanguages = this.detectCodeLanguages(structuredData);

        return {
            text: processedText,
            structuredData,
            metadata: {
                originalLength,
                processedLength,
                extractedTags,
                detectedLanguages,
                processingTime
            }
        };
    }

    /**
     * Normalize whitespace in text
     * @private
     */
    private normalizeWhitespace(text: string): string {
        // Trim leading/trailing whitespace and collapse multiple spaces
        return text.trim().replace(/\s+/g, ' ');
    }

    /**
     * Parse XML tags from text
     * @private
     */
    private parseXmlTags(text: string): {
        text: string;
        textWithoutTags: string;
        data: Record<string, any>;
        foundTags: string[];
    } {
        const data: Record<string, any> = {};
        const foundTags: string[] = [];
        let textWithoutTags = text;

        // Define tags to look for (standard + custom)
        const tagsToFind = [
            ...Object.values(StandardTags),
            ...(this.options.customTags || [])
        ];

        // Process each tag type
        for (const tag of tagsToFind) {
            const openTag = `<${tag}>`;
            const closeTag = `</${tag}>`;

            // Look for tags in the text
            let startIndex = text.indexOf(openTag);
            while (startIndex !== -1) {
                const endIndex = text.indexOf(closeTag, startIndex + openTag.length);
                if (endIndex === -1) break;

                // Extract content between tags
                const content = text.substring(startIndex + openTag.length, endIndex);

                // Store extracted content in structured data
                if (!data[tag]) {
                    data[tag] = content;
                } else if (Array.isArray(data[tag])) {
                    data[tag].push(content);
                } else {
                    data[tag] = [data[tag], content];
                }

                // Add to found tags list if not already there
                if (!foundTags.includes(tag)) {
                    foundTags.push(tag);
                }

                // Remove from textWithoutTags
                const fullTagWithContent = text.substring(startIndex, endIndex + closeTag.length);
                textWithoutTags = textWithoutTags.replace(fullTagWithContent, ' ');

                // Move to next occurrence
                startIndex = text.indexOf(openTag, endIndex + closeTag.length);
            }
        }

        // Special handling for nested structured tags
        if (data[StandardTags.ADDITIONAL_DATA]) {
            this.handleNestedStructures(data);
        }

        // Clean up textWithoutTags (normalize whitespace)
        textWithoutTags = this.normalizeWhitespace(textWithoutTags);

        return { text, textWithoutTags, data, foundTags };
    }

    /**
     * Handle nested structures within the main tags
     * @private
     */
    private handleNestedStructures(data: Record<string, any>): void {
        // Process ADDITIONAL_DATA tag which may contain nested structures
        if (data[StandardTags.ADDITIONAL_DATA]) {
            const additionalData = data[StandardTags.ADDITIONAL_DATA];
            const nestedData: Record<string, any> = {};

            // Process CURRENT_FILE
            const currentFileRegex = /<current_file>([\s\S]*?)<\/current_file>/g;
            let currentFileMatch;
            const currentFiles = [];

            while ((currentFileMatch = currentFileRegex.exec(additionalData)) !== null) {
                const fileContent = currentFileMatch[1];
                const pathMatch = /Path:\s*(.*?)(?:\n|$)/.exec(fileContent);
                const lineMatch = /Line:\s*(\d+)(?:\n|$)/.exec(fileContent);
                const lineContentMatch = /Line Content:\s*`(.*?)`(?:\n|$)/.exec(fileContent);

                if (pathMatch) {
                    const fileInfo: Record<string, any> = {
                        path: pathMatch[1].trim()
                    };

                    if (lineMatch) fileInfo.line = parseInt(lineMatch[1]);
                    if (lineContentMatch) fileInfo.lineContent = lineContentMatch[1];

                    currentFiles.push(fileInfo);
                }
            }

            if (currentFiles.length > 0) {
                nestedData.currentFiles = currentFiles;
            }

            // Process ATTACHED_FILES
            const attachedFilesRegex = /<file_contents>([\s\S]*?)<\/file_contents>/g;
            let attachedFileMatch;
            const attachedFiles = [];

            while ((attachedFileMatch = attachedFilesRegex.exec(additionalData)) !== null) {
                const fileContent = attachedFileMatch[1];
                const pathMatch = /```path=(.*?)(?:,|\s|$)/.exec(fileContent);
                const linesMatch = /lines=(\d+)-(\d+)/.exec(fileContent);

                if (pathMatch) {
                    const fileInfo: Record<string, any> = {
                        path: pathMatch[1].trim(),
                        content: fileContent.replace(/```path=.*?\n/, '').replace(/```$/, '')
                    };

                    if (linesMatch) {
                        fileInfo.lineRange = [parseInt(linesMatch[1]), parseInt(linesMatch[2])];
                    }

                    attachedFiles.push(fileInfo);
                }
            }

            if (attachedFiles.length > 0) {
                nestedData.attachedFiles = attachedFiles;
            }

            // Process LINTER_ERRORS
            const linterErrorsRegex = /<linter_errors>([\s\S]*?)<\/linter_errors>/g;
            let linterErrorMatch;
            const linterErrors = [];

            while ((linterErrorMatch = linterErrorsRegex.exec(additionalData)) !== null) {
                const errorContent = linterErrorMatch[1];
                const fileMatch = /File:\s*(.*?)(?:\n|$)/.exec(errorContent);

                if (fileMatch) {
                    const fileErrors: Record<string, any> = {
                        file: fileMatch[1].trim(),
                        errors: []
                    };

                    const errorRegex = /Line\s+(\d+):\s*(.*?)(?:\n|$)/g;
                    let errorLineMatch;

                    while ((errorLineMatch = errorRegex.exec(errorContent)) !== null) {
                        fileErrors.errors.push({
                            line: parseInt(errorLineMatch[1]),
                            message: errorLineMatch[2].trim(),
                            severity: 1 // Default severity if not specified
                        });
                    }

                    linterErrors.push(fileErrors);
                }
            }

            if (linterErrors.length > 0) {
                nestedData.linterErrors = linterErrors;
            }

            // Extract TERMINAL_OUTPUT
            const terminalOutputMatch = /<terminal_output>([\s\S]*?)<\/terminal_output>/.exec(additionalData);
            if (terminalOutputMatch) {
                nestedData.terminalOutput = terminalOutputMatch[1];
            }

            // Replace the raw string with the parsed structure
            data[StandardTags.ADDITIONAL_DATA] = nestedData;
        }
    }

    /**
     * Parse markdown syntax
     * @private
     */
    private parseMarkdown(text: string): { text: string; data: Record<string, any> } {
        const data: Record<string, any> = {
            codeBlocks: [],
            headings: [],
            lists: []
        };

        let processedText = text;

        // Extract code blocks (```language\ncode```)
        const codeBlockRegex = /```([a-z]*)\n([\s\S]*?)```/g;
        let codeMatch;
        while ((codeMatch = codeBlockRegex.exec(text)) !== null) {
            const language = codeMatch[1] || 'text';
            const code = codeMatch[2];

            data.codeBlocks.push({ language, code });
        }

        // Extract headings (# Heading)
        const headingRegex = /^(#{1,6})\s+(.+)$/gm;
        let headingMatch;
        while ((headingMatch = headingRegex.exec(text)) !== null) {
            const level = headingMatch[1].length;
            const content = headingMatch[2].trim();

            data.headings.push({ level, content });
        }

        // Extract lists (- item or 1. item)
        const listRegex = /^(\s*)([*\-+]|\d+\.)\s+(.+)$/gm;
        let listMatch;
        while ((listMatch = listRegex.exec(text)) !== null) {
            const indent = listMatch[1].length;
            const marker = listMatch[2];
            const content = listMatch[3].trim();
            const isOrdered = /^\d+\./.test(marker);

            data.lists.push({ indent, isOrdered, content });
        }

        return { text: processedText, data };
    }

    /**
     * Extract metadata from special comments
     * @private
     */
    private extractMetadata(text: string): { text: string; metadata: Record<string, any> } {
        const metadata: Record<string, any> = {};
        let processedText = text;

        // Look for metadata in format: <!-- key: value -->
        const metadataRegex = /<!--\s*([^:]+):\s*([^>]*?)\s*-->/g;
        let metadataMatch;
        while ((metadataMatch = metadataRegex.exec(text)) !== null) {
            const key = metadataMatch[1].trim();
            const value = metadataMatch[2].trim();

            metadata[key] = value;

            // Remove from processed text
            processedText = processedText.replace(metadataMatch[0], '');
        }

        return { text: processedText, metadata };
    }

    /**
     * Detect programming languages in code blocks
     * @private
     */
    private detectCodeLanguages(structuredData: Record<string, any>): string[] {
        const languages = new Set<string>();

        // Extract from markdown code blocks
        if (structuredData.markdown?.codeBlocks) {
            for (const block of structuredData.markdown.codeBlocks) {
                if (block.language && block.language !== 'text') {
                    languages.add(block.language);
                }
            }
        }

        // Extract from file contents (attached files)
        if (structuredData.tags?.[StandardTags.ADDITIONAL_DATA]?.attachedFiles) {
            for (const file of structuredData.tags[StandardTags.ADDITIONAL_DATA].attachedFiles) {
                const extension = file.path.split('.').pop()?.toLowerCase();
                if (extension) {
                    const language = this.extensionToLanguage(extension);
                    if (language) {
                        languages.add(language);
                    }
                }
            }
        }

        return Array.from(languages);
    }

    /**
     * Convert file extension to language name
     * @private
     */
    private extensionToLanguage(extension: string): string | null {
        const mapping: Record<string, string> = {
            'js': 'javascript',
            'ts': 'typescript',
            'jsx': 'javascript',
            'tsx': 'typescript',
            'py': 'python',
            'rb': 'ruby',
            'java': 'java',
            'c': 'c',
            'cpp': 'cpp',
            'h': 'c',
            'hpp': 'cpp',
            'cs': 'csharp',
            'go': 'go',
            'rs': 'rust',
            'php': 'php',
            'html': 'html',
            'css': 'css',
            'scss': 'scss',
            'sass': 'sass',
            'json': 'json',
            'md': 'markdown',
            'sql': 'sql',
            'sh': 'bash',
            'bash': 'bash',
            'yml': 'yaml',
            'yaml': 'yaml',
            'xml': 'xml',
            'swift': 'swift',
            'kt': 'kotlin',
            'dart': 'dart'
        };

        return mapping[extension] || null;
    }
}

/**
 * Factory function to create a text preprocessor with default options
 */
export function createTextPreprocessor(options?: TextPreprocessingOptions): TextPreprocessor {
    return new TextPreprocessor(options);
} 