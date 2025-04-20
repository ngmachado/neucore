import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a UUID v4
 * @returns Generated UUID
 */
export function generateUUID(): string {
    return uuidv4();
}

/**
 * Check if a string is a valid UUID
 * @param str String to check
 * @returns True if valid UUID
 */
export function isValidUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
} 