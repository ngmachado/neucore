/**
 * RAG Preprocessing utilities
 * 
 * This module contains functions for preprocessing text before generating embeddings or
 * performing search operations.
 */
import { RAGPreprocessingOptions } from '../../types/rag';

/**
 * Common English stop words
 */
export const DEFAULT_STOP_WORDS = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has',
    'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was',
    'were', 'will', 'with', 'this', 'i', 'you', 'your', 'we', 'our', 'they', 'their',
    'am', 'been', 'being', 'had', 'having', 'do', 'does', 'did', 'doing',
    'can', 'could', 'should', 'would', 'may', 'might', 'must', 'shall', 'how',
]);

/**
 * Remove Markdown formatting
 * @param text The text to clean
 * @returns Cleaned text without markdown
 */
export function removeMarkdown(text: string): string {
    if (!text) return '';

    return text
        .replace(/```[\s\S]*?```/g, '') // Code blocks
        .replace(/`.*?`/g, '')           // Inline code
        .replace(/#{1,6}\s*(.*)/g, '$1') // Headers
        .replace(/!\[(.*?)\]\(.*?\)/g, '$1') // Images
        .replace(/\[(.*?)\]\(.*?\)/g, '$1')  // Links
        .replace(/^\s*[-*+]\s+/gm, '')      // List items
        .replace(/^\s*\d+\.\s+/gm, '')      // Numbered lists
        .replace(/^\s*[-*_]{3,}\s*$/gm, ''); // Horizontal rules
}

/**
 * Remove code snippets
 * @param text The text to clean
 * @returns Cleaned text without code
 */
export function removeCode(text: string): string {
    if (!text) return '';

    return text
        .replace(/```[\s\S]*?```/g, '')  // Markdown code blocks
        .replace(/`.*?`/g, '')           // Inline code
        .replace(/<pre>[\s\S]*?<\/pre>/g, '') // HTML pre elements
        .replace(/<code>[\s\S]*?<\/code>/g, '') // HTML code elements
        .replace(/\/\*[\s\S]*?\*\//g, '') // Multiline comments
        .replace(/\/\/.*/g, '');          // Single line comments
}

/**
 * Remove URLs from text
 * @param text The text to clean
 * @returns Cleaned text without URLs
 */
export function removeUrls(text: string): string {
    if (!text) return '';

    return text
        .replace(/(https?:\/\/)?(www\.)?([^\s]+\.[^\s]+)/g, '');
}

/**
 * Normalize whitespace
 * @param text The text to clean
 * @returns Text with normalized whitespace
 */
export function normalizeWhitespace(text: string): string {
    if (!text) return '';

    return text
        .replace(/\s+/g, ' ')      // Replace multiple spaces with single space
        .replace(/\n{3,}/g, '\n\n') // Replace multiple newlines with double newline
        .trim();                   // Remove leading/trailing whitespace
}

/**
 * Remove stop words from text
 * @param text The text to process
 * @param stopWords Optional custom stop words set
 * @returns Text with stop words removed
 */
export function removeStopWords(text: string, stopWords = DEFAULT_STOP_WORDS): string {
    if (!text) return '';

    return text.split(' ')
        .filter(word => word.length > 0 && !stopWords.has(word.toLowerCase()))
        .join(' ');
}

/**
 * Preprocess text using the specified options
 * @param text The text to preprocess
 * @param options Preprocessing options
 * @returns Preprocessed text
 */
export function preprocessText(text: string, options?: RAGPreprocessingOptions): string {
    if (!text) return '';

    const opts = {
        removeMarkdown: true,
        removeCode: true,
        removeUrls: true,
        normalizeCasing: true,
        removeExtraWhitespace: true,
        removeStopWords: false,
        ...options
    };

    let processed = text;

    if (opts.removeMarkdown) {
        processed = removeMarkdown(processed);
    }

    if (opts.removeCode) {
        processed = removeCode(processed);
    }

    if (opts.removeUrls) {
        processed = removeUrls(processed);
    }

    if (opts.normalizeCasing) {
        processed = processed.toLowerCase();
    }

    if (opts.removeExtraWhitespace) {
        processed = normalizeWhitespace(processed);
    }

    if (opts.removeStopWords) {
        processed = removeStopWords(processed);
    }

    if (opts.maxLength && processed.length > opts.maxLength) {
        processed = processed.substring(0, opts.maxLength);
    }

    return processed;
}

/**
 * Extract significant terms from query (non-stop words)
 * @param query The query to analyze
 * @param stopWords Optional custom stop words set
 * @returns Array of significant terms
 */
export function extractQueryTerms(query: string, stopWords = DEFAULT_STOP_WORDS): string[] {
    if (!query) return [];

    return query
        .toLowerCase()
        .split(/\s+/)
        .filter(term => term.length > 2) // Filter very short words
        .filter(term => !stopWords.has(term)); // Filter stop words
}

/**
 * Detect if text contains technical content that should be preserved
 * @param text Text to check
 * @returns True if contains technical content
 */
function containsTechnicalContent(text: string): boolean {
    if (!text) return false;

    // Patterns that indicate technical content
    const technicalPatterns = [
        /```[\s\S]*?```/,                   // Code blocks
        /`[^`]+`/,                          // Inline code
        /<[a-z][^>]*>/i,                    // HTML tags
        /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/, // Email addresses
        /\b\d+\.\d+\.\d+\b/,                // Version numbers
        /\b0x[a-f0-9]+\b/i,                 // Hex numbers
        /\[\[[^\]]+\]\]/,                   // Wiki links
        /\{\{[^}]+\}\}/                     // Template vars
    ];

    return technicalPatterns.some(pattern => pattern.test(text));
}

/**
 * Checks if text contains a partial URL that shouldn't be split
 * @param text - The text to check
 * @returns True if a partial URL is detected
 */
function containsPartialUrl(text: string): boolean {
    // Check for common URL patterns or fragments
    return /https?:\/\/[^\s]*$/.test(text) || // URL at the end
        /^[^\s]*\.[a-z]{2,}\//.test(text) || // Domain/path at beginning
        /\b[a-z0-9]+(\.com|\.org|\.io|\.eth)\b/.test(text); // Common TLDs
}

/**
 * Finds optimal split point that preserves semantic units
 * @param text - Text to analyze
 * @param targetIndex - Ideal split index
 * @param maxSearchDistance - How far to look for better split point
 * @returns The optimal index to split the text
 */
function findOptimalSplitPoint(text: string, targetIndex: number, maxSearchDistance = 150): number {
    if (!text || targetIndex >= text.length) {
        return targetIndex;
    }

    const endIndex = Math.min(text.length, targetIndex + maxSearchDistance);
    const searchRange = text.substring(targetIndex, endIndex);

    // Best split points in descending order of preference:

    // 1. Double newline (paragraph boundary)
    const paragraphMatch = searchRange.match(/\n\s*\n/);
    if (paragraphMatch && paragraphMatch.index !== undefined) {
        return targetIndex + paragraphMatch.index + paragraphMatch[0].length;
    }

    // 2. Single newline
    const newlineIndex = searchRange.indexOf('\n');
    if (newlineIndex >= 0) {
        return targetIndex + newlineIndex + 1;
    }

    // 3. End of sentence (.!?) followed by space
    const sentenceMatch = searchRange.match(/[.!?]\s/);
    if (sentenceMatch && sentenceMatch.index !== undefined) {
        return targetIndex + sentenceMatch.index + 2;
    }

    // 4. End of clause (,;:) followed by space
    const clauseMatch = searchRange.match(/[,;:]\s/);
    if (clauseMatch && clauseMatch.index !== undefined) {
        return targetIndex + clauseMatch.index + 2;
    }

    // 5. Space between words (avoid splitting words)
    const spaceIndex = searchRange.indexOf(' ');
    if (spaceIndex >= 0) {
        return targetIndex + spaceIndex + 1;
    }

    // 6. Default to original target if no better point found
    return targetIndex;
}

/**
 * Split text into semantic chunks with improved boundary detection
 * 
 * This implementation prioritizes:
 * - Preserving paragraphs and sentences as complete units
 * - Preventing URL fragmentation
 * - Using smart boundary detection for improved context
 * - Allowing slight size flexibility for semantic integrity
 * 
 * @param text The text to split into chunks
 * @param chunkSize The target size of each chunk in characters
 * @param overlap The number of characters to overlap between chunks
 * @returns Array of text chunks
 */
export function chunkText(text: string, chunkSize = 1000, overlap = 200): string[] {
    if (!text || chunkSize <= 0) {
        return [];
    }

    // Handle small texts
    if (text.length <= chunkSize) {
        return [text];
    }

    const chunks: string[] = [];
    let startIndex = 0;

    // First try splitting by paragraphs (respect document structure)
    const paragraphs = text.split(/\n\s*\n/);
    if (paragraphs.length > 1 && paragraphs.every(p => p.length <= chunkSize * 1.5)) {
        let currentChunk = '';

        for (const paragraph of paragraphs) {
            if (!paragraph.trim()) continue;

            // If adding this paragraph exceeds chunk size and we already have content
            if (currentChunk && currentChunk.length + paragraph.length + 2 > chunkSize) {
                chunks.push(currentChunk);

                // Calculate overlap
                if (overlap > 0 && currentChunk.length > overlap) {
                    const overlapStart = currentChunk.length - Math.min(overlap, currentChunk.length);
                    currentChunk = currentChunk.substring(overlapStart);
                } else {
                    currentChunk = '';
                }
            }

            // Add paragraph with proper spacing
            currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        }

        // Add final chunk if not empty
        if (currentChunk) {
            chunks.push(currentChunk);
        }

        return chunks;
    }

    // Use more advanced semantic chunking for complex documents
    while (startIndex < text.length) {
        // Determine target end of this chunk
        let endIndex = startIndex + chunkSize;

        // If we're near the end of text, just include the rest
        if (endIndex >= text.length) {
            chunks.push(text.substring(startIndex));
            break;
        }

        // Check for technical content or URLs that shouldn't be split
        const checkText = text.substring(Math.max(0, endIndex - 30), Math.min(text.length, endIndex + 30));

        // Allow chunks to be up to 50% larger if they contain technical content or URLs
        // that we want to preserve intact
        const needsFlexibleSize = containsPartialUrl(checkText) || containsTechnicalContent(checkText);
        const flexibleSize = needsFlexibleSize ?
            Math.min(chunkSize * 1.5, text.length - startIndex) : chunkSize;

        // Find optimal semantic boundary
        endIndex = findOptimalSplitPoint(
            text,
            startIndex + flexibleSize,
            Math.floor(chunkSize * 0.2) // Search up to 20% of chunk size for better boundary
        );

        // Extract the chunk
        const chunk = text.substring(startIndex, endIndex);
        chunks.push(chunk);

        // Move start for next chunk, accounting for overlap
        startIndex = Math.max(0, endIndex - overlap);

        // Avoid starting in the middle of a word
        if (startIndex > 0 && startIndex < text.length &&
            !/\s/.test(text[startIndex]) && /\S/.test(text[startIndex])) {
            // Find previous space
            const prevSpace = text.lastIndexOf(' ', startIndex);
            if (prevSpace !== -1 && prevSpace > endIndex - overlap - 50) {
                startIndex = prevSpace + 1;
            }
        }
    }

    return chunks;
} 