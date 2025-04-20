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

/**
 * Parameter schema definition for validation
 */
export interface ParameterSchema {
    /**
     * Name of the parameter
     */
    name: string;

    /**
     * Type of the parameter
     */
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';

    /**
     * Whether the parameter is required
     */
    required: boolean;

    /**
     * For validated parameters, allowed values
     */
    enum?: any[];

    /**
     * For array or object types, the schema of items/properties
     */
    schema?: ParameterSchema[] | Record<string, ParameterSchema>;

    /**
     * Custom validation function
     */
    validate?: (value: any) => boolean | string;
}

/**
 * Validates parameters against a schema
 * 
 * @param parameters Parameters to validate
 * @param paramSchema Schema to validate against
 * @returns Validation result object
 */
export function validateParameters(
    parameters: Record<string, any>,
    paramSchema: ParameterSchema[]
): { valid: boolean; error?: string } {
    try {
        // Check for required parameters
        for (const schema of paramSchema) {
            if (schema.required && !(schema.name in parameters)) {
                return {
                    valid: false,
                    error: `Missing required parameter: ${schema.name}`
                };
            }
        }

        // Validate each provided parameter
        for (const [name, value] of Object.entries(parameters)) {
            // Find the parameter schema
            const schema = paramSchema.find(p => p.name === name);

            // Skip validation for parameters not in the schema
            if (!schema) continue;

            // Validate type
            if (schema.type === 'string' && !isString(value)) {
                return {
                    valid: false,
                    error: `Parameter ${name} must be a string`
                };
            } else if (schema.type === 'number' && !isNumber(value)) {
                return {
                    valid: false,
                    error: `Parameter ${name} must be a number`
                };
            } else if (schema.type === 'boolean' && !isBoolean(value)) {
                return {
                    valid: false,
                    error: `Parameter ${name} must be a boolean`
                };
            } else if (schema.type === 'object' && !isObject(value)) {
                return {
                    valid: false,
                    error: `Parameter ${name} must be an object`
                };
            } else if (schema.type === 'array' && !isArray(value)) {
                return {
                    valid: false,
                    error: `Parameter ${name} must be an array`
                };
            }

            // Check enum values
            if (schema.enum && Array.isArray(schema.enum)) {
                try {
                    requireOneOf(value, schema.enum, name);
                } catch (error) {
                    return {
                        valid: false,
                        error: (error as Error).message
                    };
                }
            }

            // Validate nested schema for objects
            if (schema.type === 'object' && schema.schema && isObject(schema.schema) && isObject(value)) {
                const nestedSchemas = Object.entries(schema.schema).map(
                    ([key, subSchema]) => ({
                        ...subSchema,
                        name: key
                    }) as ParameterSchema
                );

                const nestedResult = validateParameters(value, nestedSchemas);
                if (!nestedResult.valid) {
                    return {
                        valid: false,
                        error: `Invalid object in ${name}: ${nestedResult.error}`
                    };
                }
            }

            // Validate array items against schema
            if (schema.type === 'array' && schema.schema && Array.isArray(value)) {
                const itemSchema = Array.isArray(schema.schema) ? schema.schema[0] : schema.schema;

                for (let i = 0; i < value.length; i++) {
                    const item = value[i];

                    if (isObject(itemSchema)) {
                        const itemSchemaWithName = {
                            ...itemSchema,
                            name: `${name}[${i}]`
                        } as ParameterSchema;

                        const itemResult = validateParameters(
                            { [`${name}[${i}]`]: item },
                            [itemSchemaWithName]
                        );

                        if (!itemResult.valid) {
                            return {
                                valid: false,
                                error: itemResult.error
                            };
                        }
                    }
                }
            }

            // Run custom validation function if provided
            if (schema.validate) {
                const validationResult = schema.validate(value);

                if (validationResult !== true && validationResult !== undefined) {
                    return {
                        valid: false,
                        error: typeof validationResult === 'string'
                            ? validationResult
                            : `Invalid value for parameter ${name}`
                    };
                }
            }
        }

        return { valid: true };
    } catch (error) {
        return {
            valid: false,
            error: error instanceof Error ? error.message : `Validation error: ${String(error)}`
        };
    }
}

/**
 * Validates an action definition
 * 
 * @param definition The action definition to validate
 * @throws Error if the definition is invalid
 */
export function validateActionDefinition(definition: any): void {
    // Check required properties
    requireProperties(definition, ['id', 'name', 'description', 'parameters', 'effects', 'requiredPermissions', 'enabled', 'visible'], 'ActionDefinition');

    // Validate ID
    requireNonEmptyString(definition.id, 'ActionDefinition.id');

    // Validate name
    requireNonEmptyString(definition.name, 'ActionDefinition.name');

    // Validate description
    requireNonEmptyString(definition.description, 'ActionDefinition.description');

    // Validate parameters is array
    if (!isArray(definition.parameters)) {
        throw new Error('ActionDefinition.parameters must be an array');
    }

    // Validate each parameter
    for (let i = 0; i < definition.parameters.length; i++) {
        const param = definition.parameters[i];
        const paramPath = `ActionDefinition.parameters[${i}]`;

        // Check required parameter properties
        requireProperties(param, ['name', 'description', 'required', 'type'], paramPath);

        // Validate parameter name
        requireNonEmptyString(param.name, `${paramPath}.name`);

        // Validate parameter description
        requireNonEmptyString(param.description, `${paramPath}.description`);

        // Validate parameter type
        requireOneOf(
            param.type,
            ['string', 'number', 'boolean', 'object', 'array'],
            `${paramPath}.type`
        );

        // Validate required is a boolean
        if (!isBoolean(param.required)) {
            throw new Error(`${paramPath}.required must be a boolean`);
        }

        // Validate enum if present
        if ('enum' in param && param.enum !== undefined && !isArray(param.enum)) {
            throw new Error(`${paramPath}.enum must be an array`);
        }
    }

    // Validate effects array
    if (!isArray(definition.effects)) {
        throw new Error('ActionDefinition.effects must be an array');
    }

    // Validate requiredPermissions array
    if (!isArray(definition.requiredPermissions)) {
        throw new Error('ActionDefinition.requiredPermissions must be an array');
    }

    // Validate enabled is boolean
    if (!isBoolean(definition.enabled)) {
        throw new Error('ActionDefinition.enabled must be a boolean');
    }

    // Validate visible is boolean
    if (!isBoolean(definition.visible)) {
        throw new Error('ActionDefinition.visible must be a boolean');
    }
} 