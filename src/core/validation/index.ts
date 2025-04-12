/**
 * Validation module for NeuroCore
 * 
 * Provides runtime type checking and validation utilities.
 */

/**
 * Validates that a value is not null or undefined
 * 
 * @param value The value to check
 * @param name Name of the parameter for error messages
 * @throws Error if the value is null or undefined
 */
export function requireValue<T>(value: T | null | undefined, name: string): T {
    if (value === null || value === undefined) {
        throw new Error(`${name} is required but was ${value === null ? 'null' : 'undefined'}`);
    }
    return value;
}

/**
 * Validates that a string is not empty
 * 
 * @param value The string to check
 * @param name Name of the parameter for error messages
 * @throws Error if the string is empty
 */
export function requireNonEmptyString(value: string | null | undefined, name: string): string {
    const stringValue = requireValue(value, name);
    if (stringValue.trim() === '') {
        throw new Error(`${name} must not be empty`);
    }
    return stringValue;
}

/**
 * Validates that a value is a positive number
 * 
 * @param value The value to check
 * @param name Name of the parameter for error messages
 * @throws Error if the value is not a positive number
 */
export function requirePositiveNumber(value: number | null | undefined, name: string): number {
    const numberValue = requireValue(value, name);
    if (typeof numberValue !== 'number' || isNaN(numberValue) || numberValue <= 0) {
        throw new Error(`${name} must be a positive number`);
    }
    return numberValue;
}

/**
 * Validates that an array is not empty
 * 
 * @param value The array to check
 * @param name Name of the parameter for error messages
 * @throws Error if the array is empty
 */
export function requireNonEmptyArray<T>(value: T[] | null | undefined, name: string): T[] {
    const arrayValue = requireValue(value, name);
    if (!Array.isArray(arrayValue) || arrayValue.length === 0) {
        throw new Error(`${name} must be a non-empty array`);
    }
    return arrayValue;
}

/**
 * Validates that a value is within a specific range
 * 
 * @param value The value to check
 * @param min Minimum value (inclusive)
 * @param max Maximum value (inclusive)
 * @param name Name of the parameter for error messages
 * @throws Error if the value is outside the range
 */
export function requireRange(
    value: number | null | undefined,
    min: number,
    max: number,
    name: string
): number {
    const numberValue = requireValue(value, name);
    if (typeof numberValue !== 'number' || isNaN(numberValue) || numberValue < min || numberValue > max) {
        throw new Error(`${name} must be a number between ${min} and ${max}`);
    }
    return numberValue;
}

/**
 * Validates that a value matches one of the allowed values
 * 
 * @param value The value to check
 * @param allowedValues Array of allowed values
 * @param name Name of the parameter for error messages
 * @throws Error if the value does not match any allowed value
 */
export function requireOneOf<T>(
    value: T | null | undefined,
    allowedValues: T[],
    name: string
): T {
    const actualValue = requireValue(value, name);
    if (!allowedValues.includes(actualValue)) {
        throw new Error(`${name} must be one of: ${allowedValues.join(', ')}`);
    }
    return actualValue;
}

/**
 * Validates an email address format
 * 
 * @param value The email to check
 * @param name Name of the parameter for error messages
 * @throws Error if the email format is invalid
 */
export function requireValidEmail(value: string | null | undefined, name: string): string {
    const email = requireNonEmptyString(value, name);
    // Basic email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new Error(`${name} must be a valid email address`);
    }
    return email;
}

/**
 * Validates an object has required properties
 * 
 * @param obj The object to check
 * @param requiredProps Array of required property names
 * @param name Name of the object for error messages
 * @throws Error if any required property is missing
 */
export function requireProperties<T extends object>(
    obj: T | null | undefined,
    requiredProps: (keyof T)[],
    name: string
): T {
    const actualObj = requireValue(obj, name);

    if (typeof actualObj !== 'object') {
        throw new Error(`${name} must be an object`);
    }

    const missingProps = requiredProps.filter(prop => !(prop in actualObj));
    if (missingProps.length > 0) {
        throw new Error(`${name} is missing required properties: ${missingProps.join(', ')}`);
    }

    return actualObj;
}

/**
 * Type guard to check if value is an object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard to check if value is an array
 */
export function isArray(value: unknown): value is unknown[] {
    return Array.isArray(value);
}

/**
 * Type guard to check if value is a string
 */
export function isString(value: unknown): value is string {
    return typeof value === 'string';
}

/**
 * Type guard to check if value is a number
 */
export function isNumber(value: unknown): value is number {
    return typeof value === 'number' && !isNaN(value);
}

/**
 * Type guard to check if value is a boolean
 */
export function isBoolean(value: unknown): value is boolean {
    return typeof value === 'boolean';
}

/**
 * Validation utilities for specific NeuroCore types can be added below
 */ 