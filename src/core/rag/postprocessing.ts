/**
 * RAG Postprocessing utilities
 * 
 * This module contains functions for processing RAG results after retrieval
 * to improve quality, remove duplicates, highlight matches, and more.
 */
import { RAGKnowledgeItem, RAGPostprocessingOptions } from '../../types/rag';
import { extractQueryTerms } from './preprocessing';

/**
 * Remove duplicate results based on content similarity
 * @param results RAG knowledge items to deduplicate
 * @param similarityThreshold Similarity threshold for deduplication (0-1)
 * @returns Deduplicated results
 */
export function deduplicateResults(
    results: RAGKnowledgeItem[],
    similarityThreshold = 0.85
): RAGKnowledgeItem[] {
    if (!results || results.length <= 1) return results;

    const uniqueResults: RAGKnowledgeItem[] = [];

    // Simple text-based deduplication
    const seen = new Set<string>();

    for (const item of results) {
        // Create a simplified representation for comparison
        const content = item.content.trim().toLowerCase();

        // Check if we've seen this content before using similarity
        let isDuplicate = false;

        for (const seenContent of seen) {
            const similarity = calculateJaccardSimilarity(content, seenContent);
            if (similarity >= similarityThreshold) {
                isDuplicate = true;
                break;
            }
        }

        if (!isDuplicate) {
            seen.add(content);
            uniqueResults.push(item);
        }
    }

    return uniqueResults;
}

/**
 * Calculate Jaccard similarity between two strings
 * @param a First string
 * @param b Second string
 * @returns Similarity score (0-1)
 */
export function calculateJaccardSimilarity(a: string, b: string): number {
    if (!a || !b) return 0;
    if (a === b) return 1;

    // Create sets of words
    const setA = new Set(a.split(/\s+/));
    const setB = new Set(b.split(/\s+/));

    // Calculate intersection size
    const intersection = new Set([...setA].filter(x => setB.has(x)));

    // Calculate union size
    const union = new Set([...setA, ...setB]);

    // Jaccard similarity is intersection size / union size
    return intersection.size / union.size;
}

/**
 * Highlight query terms in the content
 * @param content Text content to highlight
 * @param query The search query
 * @param highlightPrefix String to prepend to matches (e.g., "**")
 * @param highlightSuffix String to append to matches (e.g., "**")
 * @returns Highlighted content
 */
export function highlightMatches(
    content: string,
    query: string,
    highlightPrefix = '**',
    highlightSuffix = '**'
): string {
    if (!content || !query) return content;

    const terms = extractQueryTerms(query);
    if (terms.length === 0) return content;

    // Build a regex pattern to match all terms
    const pattern = new RegExp(`\\b(${terms.map(term => escapeRegExp(term)).join('|')})\\b`, 'gi');

    // Replace matches with highlighted version
    return content.replace(pattern, `${highlightPrefix}$1${highlightSuffix}`);
}

/**
 * Escape special characters in string for use in regex
 */
function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Rerank results based on term frequency and proximity
 * @param results RAG knowledge items to rerank
 * @param query The search query
 * @returns Reranked results
 */
export function rerankResults(
    results: RAGKnowledgeItem[],
    query: string
): RAGKnowledgeItem[] {
    if (!results || results.length <= 1 || !query) return results;

    const terms = extractQueryTerms(query);
    if (terms.length === 0) return results;

    // Clone results to avoid modifying the original
    const reranked = [...results];

    // Calculate a combined score: embedding similarity + term frequency + term proximity
    reranked.forEach(item => {
        const content = item.content.toLowerCase();

        // Term frequency score
        let termFrequencyScore = 0;
        terms.forEach(term => {
            const regex = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'gi');
            const matches = content.match(regex);
            termFrequencyScore += matches ? matches.length : 0;
        });

        // Term proximity score
        const proximityScore = hasProximityMatch(content, terms) ? 0.5 : 0;

        // Original relevance score (from embedding similarity)
        const embeddingScore = item.metadata?.relevanceScore || 0;

        // Normalize term frequency score (0-1 range)
        const normalizedFrequency = Math.min(1, termFrequencyScore / 10);

        // Combined score: 60% embedding similarity, 30% term frequency, 10% proximity
        const combinedScore =
            (embeddingScore * 0.6) +
            (normalizedFrequency * 0.3) +
            (proximityScore * 0.1);

        // Update metadata with new score
        if (!item.metadata) {
            item.metadata = {};
        }
        item.metadata.relevanceScore = combinedScore;
    });

    // Sort by combined score
    return reranked.sort((a, b) =>
        (b.metadata?.relevanceScore || 0) - (a.metadata?.relevanceScore || 0)
    );
}

/**
 * Check if text contains terms in close proximity
 * @param text Text to check
 * @param terms Terms to find
 * @returns Whether terms are found in proximity
 */
export function hasProximityMatch(text: string, terms: string[]): boolean {
    if (!text || !terms.length) {
        return false;
    }

    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);

    // Find all positions for each term
    const allPositions = terms.flatMap(term =>
        words.reduce((positions, word, idx) => {
            if (word.includes(term)) positions.push(idx);
            return positions;
        }, [] as number[])
    ).sort((a, b) => a - b);

    if (allPositions.length < 2) return false;

    // Check proximity (within 5 words)
    for (let i = 0; i < allPositions.length - 1; i++) {
        if (Math.abs(allPositions[i] - allPositions[i + 1]) <= 5) {
            return true;
        }
    }

    return false;
}

/**
 * Extract relevant snippets from content (context window around matches)
 * @param content Full text content
 * @param query Search query
 * @param windowSize Number of words to include before/after match
 * @returns Snippet of relevant text
 */
export function extractSnippet(
    content: string,
    query: string,
    windowSize = 25
): string {
    if (!content || !query) return content;

    const terms = extractQueryTerms(query);
    if (terms.length === 0) return content;

    const words = content.split(/\s+/);
    if (words.length <= windowSize * 2) return content;

    // Find positions of all matching terms
    const matchPositions: number[] = [];
    const lowerWords = words.map(w => w.toLowerCase());

    terms.forEach(term => {
        lowerWords.forEach((word, index) => {
            if (word.includes(term.toLowerCase())) {
                matchPositions.push(index);
            }
        });
    });

    if (matchPositions.length === 0) {
        // No matches found, return first portion
        return words.slice(0, windowSize * 2).join(' ');
    }

    // Get median match position
    matchPositions.sort((a, b) => a - b);
    const medianPos = matchPositions[Math.floor(matchPositions.length / 2)];

    // Extract window around median match
    const start = Math.max(0, medianPos - windowSize);
    const end = Math.min(words.length, medianPos + windowSize);

    let snippet = words.slice(start, end).join(' ');

    // Add ellipsis if truncated
    if (start > 0) snippet = '...' + snippet;
    if (end < words.length) snippet += '...';

    return snippet;
}

/**
 * Apply postprocessing to RAG results
 * @param results RAG knowledge items
 * @param query Search query
 * @param options Postprocessing options
 * @returns Processed results
 */
export function postprocessResults(
    results: RAGKnowledgeItem[],
    query: string,
    options?: RAGPostprocessingOptions
): RAGKnowledgeItem[] {
    if (!results || results.length === 0) return results;

    const opts = {
        deduplicate: true,
        maxResults: 5,
        minRelevanceScore: 0.6,
        rerank: true,
        highlightMatches: false,
        summarize: false,
        ...options
    };

    let processed = [...results];

    // Filter by minimum score
    if (opts.minRelevanceScore > 0) {
        processed = processed.filter(item =>
            (item.metadata?.relevanceScore || 0) >= opts.minRelevanceScore
        );
    }

    // Rerank results
    if (opts.rerank && query) {
        processed = rerankResults(processed, query);
    }

    // Deduplicate results
    if (opts.deduplicate) {
        processed = deduplicateResults(processed);
    }

    // Apply highlighting if needed
    if (opts.highlightMatches && query) {
        processed = processed.map(item => ({
            ...item,
            content: highlightMatches(item.content, query)
        }));
    }

    // Extract snippets if summarize is true
    if (opts.summarize && query) {
        processed = processed.map(item => ({
            ...item,
            content: extractSnippet(item.content, query)
        }));
    }

    // Limit results
    if (opts.maxResults > 0 && processed.length > opts.maxResults) {
        processed = processed.slice(0, opts.maxResults);
    }

    return processed;
} 