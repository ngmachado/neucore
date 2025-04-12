/**
 * Logging functionality for NeuroCore
 */

import { LogLevel } from '../../types';

// Default log level
let globalLogLevel = LogLevel.INFO;

/**
 * Set the global log level
 * @param level Log level to set
 */
export function setLogLevel(level: LogLevel): void {
    globalLogLevel = level;
}

/**
 * Get the current global log level
 * @returns Current log level
 */
export function getLogLevel(): LogLevel {
    return globalLogLevel;
}

/**
 * Logger interface
 */
export interface Logger {
    debug(message: string, ...args: any[]): void;
    info(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
}

/**
 * Console logger implementation
 */
class ConsoleLogger implements Logger {
    constructor(private name: string) { }

    debug(message: string, ...args: any[]): void {
        if (globalLogLevel <= LogLevel.DEBUG) {
            console.debug(`[${this.name}] DEBUG:`, message, ...args);
        }
    }

    info(message: string, ...args: any[]): void {
        if (globalLogLevel <= LogLevel.INFO) {
            console.info(`[${this.name}] INFO:`, message, ...args);
        }
    }

    warn(message: string, ...args: any[]): void {
        if (globalLogLevel <= LogLevel.WARN) {
            console.warn(`[${this.name}] WARN:`, message, ...args);
        }
    }

    error(message: string, ...args: any[]): void {
        if (globalLogLevel <= LogLevel.ERROR) {
            console.error(`[${this.name}] ERROR:`, message, ...args);
        }
    }
}

/**
 * Logger factory
 * @param name Logger name
 * @returns Logger instance
 */
export function getLogger(name: string): Logger {
    return new ConsoleLogger(name);
} 