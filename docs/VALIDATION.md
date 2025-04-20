# neucore Validation System

The Validation System provides utilities for runtime type checking and data validation.

> **Navigation**: [Back to README](../README.md) | [System Documentation](SYSTEM-DOCUMENTATION.md)

The neucore framework provides a standardized validation system to ensure consistency, reliability, and security across all components. This document outlines the validation utilities and how to use them in your code.

## Core Validation Principles

1. **Centralized Validation**: All validation functionality is centralized in the `src/core/validation` module.
2. **Consistent Error Handling**: Validation errors use a standardized format and provide meaningful error messages.
3. **Reusable Utilities**: The validation system provides reusable utilities for common validation scenarios.
4. **Type Safety**: Validation functions help ensure type safety throughout the codebase.

## Using the Validation System

### Basic Type Validation

Use type validation functions to check the type of values:

```typescript
import { isString, isNumber, isBoolean, isObject, isArray } from '../core/validation';

// Type checking
if (isString(value)) {
  // Handle string
} else if (isNumber(value)) {
  // Handle number
}
```

### Value Requirements

Use requirement functions to validate and ensure required values:

```typescript
import { 
  requireValue, 
  requireNonEmptyString,
  requirePositiveNumber,
  requireRange,
  requireOneOf,
  requireProperties
} from '../core/validation';

// Ensure a value is provided
const id = requireValue(options.id, 'id');

// Ensure a string is not empty
const name = requireNonEmptyString(options.name, 'name');

// Ensure a number is positive
const count = requirePositiveNumber(options.count, 'count');

// Ensure a number is within range
const temperature = requireRange(options.temperature, 0, 1, 'temperature');

// Ensure a value is one of allowed options
const model = requireOneOf(options.model, ['gpt-4', 'claude-3'], 'model');

// Ensure an object has required properties
const config = requireProperties(options.config, ['apiKey', 'endpoint'], 'config');
```

### Parameter Validation

For validating structured parameters against a schema:

```typescript
import { validateParameters, ParameterSchema } from '../core/validation';

// Define parameter schema
const paramSchema: ParameterSchema[] = [
  {
    name: 'query',
    type: 'string',
    required: true
  },
  {
    name: 'limit',
    type: 'number',
    required: false
  }
];

// Validate parameters
const validationResult = validateParameters(userParams, paramSchema);
if (!validationResult.valid) {
  throw new Error(validationResult.error);
}
```

### Action Definition Validation

For validating action definitions:

```typescript
import { validateActionDefinition } from '../core/validation';

// Validate an action definition
validateActionDefinition(myActionDefinition);
```

## Extending the Validation System

When adding new validation utilities:

1. Add them to the `src/core/validation/index.ts` file
2. Follow the existing naming patterns (`require*`, `is*`, `validate*`)
3. Include comprehensive JSDoc comments
4. Consider error message clarity and consistency

## Best Practices

1. **Use Early Validation**: Validate inputs at the entry point of functions or methods.
2. **Provide Clear Paths**: Avoid complex conditional validation - provide clear success/failure paths.
3. **Consistent Parameter Names**: Use the same parameter names throughout your validation.
4. **Descriptive Error Messages**: Ensure error messages clearly indicate what went wrong.

## Integration with Error Handling

The validation system integrates with NeuroCore's error handling:

```typescript
import { ValidationError } from '../core/errors';

try {
  const value = requireNonEmptyString(input, 'input');
  // Process valid value
} catch (error) {
  throw new ValidationError(`Invalid input: ${error.message}`);
}
```

## Purpose

The validation system aims to solve several common issues:

1. **Early error detection**: Catch invalid data before it causes downstream errors
2. **Clear error messages**: Provide descriptive error messages that help with debugging
3. **Runtime type safety**: Add additional runtime checks beyond TypeScript's compile-time checks
4. **Input validation**: Validate user and external system inputs
5. **Consistent validation patterns**: Standardize how validation is performed across the codebase

## Usage Examples

### Basic Parameter Validation

```typescript
import { requireValue, requireNonEmptyString } from '../validation';

function createUser(name: string | null, email: string | null) {
  const validName = requireNonEmptyString(name, 'name');
  const validEmail = requireNonEmptyString(email, 'email');
  
  // Now you can safely use validName and validEmail
  // If they were invalid, an error would have been thrown
}
```

### Complex Object Validation

```typescript
import { requireProperties, requireNonEmptyString, requirePositiveNumber } from '../validation';

interface UserData {
  name: string;
  email: string;
  age: number;
}

function processUserData(data: unknown) {
  // First ensure it's an object with required properties
  const userData = requireProperties(data as UserData, ['name', 'email', 'age'], 'userData');
  
  // Then validate specific fields
  const name = requireNonEmptyString(userData.name, 'userData.name');
  const email = requireNonEmptyString(userData.email, 'userData.email');
  const age = requirePositiveNumber(userData.age, 'userData.age');
  
  // Now you can safely use the validated data
}
```

### Enum Value Validation

```typescript
import { requireOneOf } from '../validation';
import { ReasoningMethod } from '../reasoning/types';

function configureReasoner(method: string) {
  const validMethod = requireOneOf(
    method as ReasoningMethod,
    Object.values(ReasoningMethod),
    'reasoning method'
  );
  
  // Now you can be sure validMethod is one of the defined enum values
}
```

### Range Validation

```typescript
import { requireRange } from '../validation';

function setTemperature(value: number) {
  // Ensure temperature is between 0.0 and 2.0
  const validTemp = requireRange(value, 0, 2, 'temperature');
  
  // Now you can safely use validTemp
}
```

## Best Practices

### 1. Validate Early

Validate inputs at the boundaries of your system:
- API endpoints
- Constructor parameters
- Function parameters with external inputs

```typescript
constructor(modelProvider: IModelProvider) {
  this.modelProvider = requireValue(modelProvider, 'modelProvider');
}
```

### 2. Use Type Guards for Unknown Data

When dealing with data from external sources, use type guards to narrow types:

```typescript
function processInput(data: unknown) {
  if (!isObject(data)) {
    throw new Error('Input must be an object');
  }
  
  if (!isString(data.query)) {
    throw new Error('query must be a string');
  }
  
  // Now TypeScript knows data.query is a string
}
```

### 3. Chain Validations

Chain validations to build up complex validation logic:

```typescript
const email = requireValidEmail(
  requireNonEmptyString(userInput.email, 'email'),
  'email'
);
```

### 4. Add Domain-Specific Validation

Create validation functions specific to your domain:

```typescript
// In a domain-specific validation file
export function requireValidApiKey(value: string | null | undefined): string {
  const key = requireNonEmptyString(value, 'API key');
  if (!/^sk-[A-Za-z0-9]{32,}$/.test(key)) {
    throw new Error('Invalid API key format');
  }
  return key;
}
```

## Integration with Components

### Using with Model Providers

```typescript
import { requireValue, requireNonEmptyString } from '../validation';

export class AnthropicProvider implements IModelProvider {
  private apiKey: string;
  
  constructor(config: AnthropicConfig) {
    const validConfig = requireValue(config, 'config');
    this.apiKey = requireNonEmptyString(validConfig.apiKey, 'config.apiKey');
  }
  
  async generateCompletion(params: CompletionParams): Promise<CompletionResponse> {
    requireValue(params, 'params');
    requireNonEmptyString(params.prompt, 'params.prompt');
    
    // Now you can safely use the validated parameters
  }
}
```

### Using with Action System

```typescript
import { requireProperties, requireNonEmptyString } from '../validation';

export async function executeAction(
  actionId: string,
  parameters: Record<string, any>,
  context: Partial<ActionContext>
): Promise<ActionResult> {
  const validActionId = requireNonEmptyString(actionId, 'actionId');
  const validContext = requireProperties(
    context as ActionContext,
    ['userId'],
    'context'
  );
  
  // Now you can safely use the validated inputs
}
```

## Error Handling

The validation functions will throw errors with descriptive messages. You can catch these at appropriate boundaries:

```typescript
try {
  const result = await actionManager.executeAction(actionId, params, context);
  return result;
} catch (error) {
  if (error instanceof Error) {
    // Log the error
    logger.error(`Action execution failed: ${error.message}`);
    
    // Return a user-friendly error
    return {
      success: false,
      error: "Unable to perform action. Please check your inputs."
    };
  }
  throw error; // Re-throw unexpected errors
}
```

## Migration Guide

To migrate existing code to use the validation system:

1. Start with high-risk areas (external inputs, complex logic)
2. Add validation to constructors and public methods
3. Replace inline validation with standard validation functions
4. Update error handling to properly catch and process validation errors

## Further Enhancements

Future enhancements to the validation system may include:

1. Schema-based validation (similar to Zod or Joi)
2. Validation decorators for classes
3. Custom error types for different validation failures
4. Asynchronous validation functions 