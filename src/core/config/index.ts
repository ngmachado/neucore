/**
 * Configuration module exports
 */

export * from './interfaces';
export * from './manager';
export * from './env';

// Export standard configuration manager instance
import { ConfigManager } from './manager';
import { EnvConfigSource } from './env';

// Create and export default configuration manager with environment variables
const defaultEnvSource = new EnvConfigSource();
export const config = new ConfigManager([defaultEnvSource]); 