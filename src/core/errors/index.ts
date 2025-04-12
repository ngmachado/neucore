/**
 * Error handling system for NeuroCore
 */

/**
 * Base error class for NeuroCore
 */
export class NeuroCoreError extends Error {
    /**
     * Error code
     */
    code: string;

    /**
     * Additional error details
     */
    details?: Record<string, any>;

    /**
     * Create a new NeuroCore error
     * @param message Error message
     * @param code Error code
     * @param details Additional error details
     */
    constructor(message: string, code = 'INTERNAL_ERROR', details?: Record<string, any>) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.details = details;

        // Maintain proper stack trace in V8 engines
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }

    /**
     * Convert error to JSON
     * @returns JSON representation of the error
     */
    toJSON(): Record<string, any> {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            details: this.details,
            stack: this.stack
        };
    }
}

/**
 * Error thrown when a validation fails
 */
export class ValidationError extends NeuroCoreError {
    constructor(message: string, details?: Record<string, any>) {
        super(message, 'VALIDATION_ERROR', details);
    }
}

/**
 * Error thrown when a plugin operation fails
 */
export class PluginError extends NeuroCoreError {
    constructor(message: string, pluginName: string, details?: Record<string, any>) {
        super(message, 'PLUGIN_ERROR', {
            ...details,
            pluginName
        });
    }
}

/**
 * Error thrown when a configuration issue occurs
 */
export class ConfigurationError extends NeuroCoreError {
    constructor(message: string, details?: Record<string, any>) {
        super(message, 'CONFIGURATION_ERROR', details);
    }
}

/**
 * Error thrown when a database operation fails
 */
export class DatabaseError extends NeuroCoreError {
    constructor(message: string, details?: Record<string, any>) {
        super(message, 'DATABASE_ERROR', details);
    }
}

/**
 * Error thrown when an initialization fails
 */
export class InitializationError extends NeuroCoreError {
    constructor(message: string, component: string, details?: Record<string, any>) {
        super(message, 'INITIALIZATION_ERROR', {
            ...details,
            component
        });
    }
}

/**
 * Error thrown when a network request fails
 */
export class NetworkError extends NeuroCoreError {
    constructor(message: string, details?: Record<string, any>) {
        super(message, 'NETWORK_ERROR', details);
    }
}

/**
 * Error thrown when a provider operation fails
 */
export class ProviderError extends NeuroCoreError {
    constructor(message: string, providerName: string, details?: Record<string, any>) {
        super(message, 'PROVIDER_ERROR', {
            ...details,
            providerName
        });
    }
}

/**
 * Error thrown when an authentication fails
 */
export class AuthenticationError extends NeuroCoreError {
    constructor(message: string, details?: Record<string, any>) {
        super(message, 'AUTHENTICATION_ERROR', details);
    }
}

/**
 * Error thrown when a rate limit is exceeded
 */
export class RateLimitError extends NeuroCoreError {
    constructor(message: string, details?: Record<string, any>) {
        super(message, 'RATE_LIMIT_ERROR', details);
    }
} 