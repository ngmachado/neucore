/**
 * Utility functions for NeuroCore
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a UUID v4 string
 * @returns A UUID v4 string
 */
export function generateUUID(): string {
    return uuidv4();
} 