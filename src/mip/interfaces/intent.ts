/**
 * Simplified Intent interface for the Model Intent Protocol (MIP)
 * 
 * This provides a more focused interface with only the essential functionality
 * needed for model selection and other MIP operations.
 */

/**
 * Core intent interface for MIP
 */
export interface MIPIntent {
    /**
     * The action to be performed
     * Examples: 'model-selection', 'task-routing', 'provider-selection'
     */
    action: string;

    /**
     * Data payload for the intent
     */
    data: Record<string, any>;
}

/**
 * Factory function to create a simple MIP intent
 */
export function createMIPIntent(action: string, data: Record<string, any> = {}): MIPIntent {
    return {
        action,
        data
    };
} 