# NeuroCore Validation System

This validation system provides utilities for runtime type checking and data validation to help prevent logic errors, improve error messages, and ensure data integrity.

> **Navigation**: [Back to README](../README.md) | [System Documentation](SYSTEM-DOCUMENTATION.md) | [Mock Migration](MOCK-MIGRATION.md)

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