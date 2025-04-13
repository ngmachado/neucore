/**
 * Helper for formatting responses for better readability
 */
export class ResponseFormatter {
    /**
     * Format an AI-generated response for better readability
     * 
     * @param response The raw response from the AI
     * @returns Formatted response with proper paragraphs and structure
     */
    public static format(response: string): string {
        if (!response) {
            return '';
        }

        // Remove any artificial signature
        response = this.removeSignature(response);

        // Break into paragraphs and trim each
        let paragraphs = response.split(/\n\n+/)
            .map(p => p.trim())
            .filter(p => p.length > 0);

        // If we have a single long paragraph, break it up
        if (paragraphs.length === 1 && paragraphs[0].length > 300) {
            paragraphs = this.breakLongParagraph(paragraphs[0]);
        }

        // Format based on length
        if (paragraphs.length <= 1) {
            // Short response, keep as is
            return paragraphs.join('\n\n');
        } else if (paragraphs.length <= 3) {
            // Medium response, simple spacing
            return paragraphs.join('\n\n');
        } else {
            // Longer response, consider adding formatting
            return this.formatLongerResponse(paragraphs);
        }
    }

    /**
     * Remove artificial signature from response
     */
    private static removeSignature(response: string): string {
        // Remove signatures like "~ Alfafrens Assistant" or "- AI Assistant" etc.
        return response.replace(/\s*[~\-]\s*\w+(\s+\w+)*\s*(Assistant|Bot|AI)\s*$/i, '');
    }

    /**
     * Break a long paragraph into smaller ones for readability
     */
    private static breakLongParagraph(paragraph: string): string[] {
        // Find natural breakpoints based on sentences
        const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];

        // Group sentences into paragraphs
        const paragraphs: string[] = [];
        let currentParagraph = '';

        for (const sentence of sentences) {
            if (currentParagraph.length + sentence.length > 200) {
                paragraphs.push(currentParagraph.trim());
                currentParagraph = sentence;
            } else {
                currentParagraph += sentence;
            }
        }

        // Add the last paragraph if not empty
        if (currentParagraph.trim().length > 0) {
            paragraphs.push(currentParagraph.trim());
        }

        return paragraphs;
    }

    /**
     * Format a longer response with appropriate structure
     */
    private static formatLongerResponse(paragraphs: string[]): string {
        // Check for list patterns in paragraphs
        const formattedParagraphs = paragraphs.map(p => {
            // If paragraph starts with a number or bullet, format as list item
            if (p.match(/^\d+\.\s+/) || p.match(/^[-*•]\s+/)) {
                return p;
            }

            // Check for potential list patterns in paragraph
            if (p.includes(', 2. ') || p.includes(': 1. ')) {
                return this.formatAsList(p);
            }

            return p;
        });

        return formattedParagraphs.join('\n\n');
    }

    /**
     * Format text as a list if it contains list-like patterns
     */
    private static formatAsList(text: string): string {
        // Look for patterns like "1. Item, 2. Item" or "steps: 1. Do this, 2. Do that"
        const listPattern = /(\d+)\.\s+([^,\d]+)(?:,\s+|$)/g;
        let match;
        let formattedText = text;

        // Replace comma-separated list with line-break list
        const matches = [];
        while ((match = listPattern.exec(text)) !== null) {
            matches.push(match);
        }

        if (matches.length >= 2) {
            // Convert comma-separated items to line-break items
            formattedText = text.replace(listPattern, (fullMatch, number, content) => {
                return `\n${number}. ${content.trim()}`;
            });

            // Remove any leading newline
            formattedText = formattedText.replace(/^\n/, '');
        }

        return formattedText;
    }
} 