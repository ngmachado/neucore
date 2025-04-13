import { describe, it, expect } from 'vitest';
import { validateAlfaFrensConfig } from '../src/environment';
import { IAgentRuntime } from '@elizaos/core';

describe('Environment configuration', () => {
    describe('validateAlfaFrensConfig', () => {
        it('should validate a complete configuration', () => {
            const mockRuntime = {
                getSetting: (key: string) => {
                    const settings: Record<string, string> = {
                        'ALFAFRENS_API_KEY': 'test-api-key',
                        'ALFAFRENS_CHANNEL_ID': 'test-channel',
                        'ALFAFRENS_USER_ID': 'test-user',
                        'ALFAFRENS_API_URL': 'https://test-api.example.com',
                        'ALFAFRENS_USERNAME': 'Test Bot',
                        'ALFAFRENS_POLL_INTERVAL': '30',
                        'ALFAFRENS_ENABLE_POST': 'true',
                        'ALFAFRENS_POST_INTERVAL_MIN': '120',
                        'ALFAFRENS_POST_INTERVAL_MAX': '300'
                    };
                    return settings[key] || null;
                }
            } as unknown as IAgentRuntime;

            const config = validateAlfaFrensConfig(mockRuntime);

            expect(config).toEqual({
                apiKey: 'test-api-key',
                channelId: 'test-channel',
                userId: 'test-user',
                baseUrl: 'https://test-api.example.com',
                username: 'Test Bot',
                pollInterval: 30,
                enablePost: true,
                postIntervalMin: 120,
                postIntervalMax: 300
            });
        });

        it('should validate configuration with only required fields', () => {
            const mockRuntime = {
                getSetting: (key: string) => {
                    const settings: Record<string, string> = {
                        'ALFAFRENS_API_KEY': 'test-api-key',
                        'ALFAFRENS_CHANNEL_ID': 'test-channel',
                        'ALFAFRENS_USER_ID': 'test-user'
                    };
                    return settings[key] || null;
                }
            } as unknown as IAgentRuntime;

            const config = validateAlfaFrensConfig(mockRuntime);

            expect(config).toEqual({
                apiKey: 'test-api-key',
                channelId: 'test-channel',
                userId: 'test-user',
                baseUrl: 'https://friendx-git-ai-api.preview.superfluid.finance',
                username: 'AI Assistant',
                pollInterval: 15,
                enablePost: false,
                postIntervalMin: 60,
                postIntervalMax: 120
            });
        });

        it('should throw error when API key is missing', () => {
            const mockRuntime = {
                getSetting: (key: string) => {
                    const settings: Record<string, string> = {
                        'ALFAFRENS_CHANNEL_ID': 'test-channel',
                        'ALFAFRENS_USER_ID': 'test-user'
                    };
                    return settings[key] || null;
                }
            } as unknown as IAgentRuntime;

            expect(() => validateAlfaFrensConfig(mockRuntime)).toThrow('ALFAFRENS_API_KEY is required');
        });

        it('should throw error when channel ID is missing', () => {
            const mockRuntime = {
                getSetting: (key: string) => {
                    const settings: Record<string, string> = {
                        'ALFAFRENS_API_KEY': 'test-api-key',
                        'ALFAFRENS_USER_ID': 'test-user'
                    };
                    return settings[key] || null;
                }
            } as unknown as IAgentRuntime;

            expect(() => validateAlfaFrensConfig(mockRuntime)).toThrow('ALFAFRENS_CHANNEL_ID is required');
        });

        it('should throw error when user ID is missing', () => {
            const mockRuntime = {
                getSetting: (key: string) => {
                    const settings: Record<string, string> = {
                        'ALFAFRENS_API_KEY': 'test-api-key',
                        'ALFAFRENS_CHANNEL_ID': 'test-channel'
                    };
                    return settings[key] || null;
                }
            } as unknown as IAgentRuntime;

            expect(() => validateAlfaFrensConfig(mockRuntime)).toThrow('ALFAFRENS_USER_ID is required');
        });

        it('should use environment variable for API URL when not in runtime settings', () => {
            const originalEnv = process.env.ALFAFRENS_API_URL;
            process.env.ALFAFRENS_API_URL = 'https://env-api.example.com';

            const mockRuntime = {
                getSetting: (key: string) => {
                    const settings: Record<string, string> = {
                        'ALFAFRENS_API_KEY': 'test-api-key',
                        'ALFAFRENS_CHANNEL_ID': 'test-channel',
                        'ALFAFRENS_USER_ID': 'test-user'
                    };
                    return settings[key] || null;
                }
            } as unknown as IAgentRuntime;

            const config = validateAlfaFrensConfig(mockRuntime);

            expect(config.baseUrl).toBe('https://env-api.example.com');

            // Restore original environment
            process.env.ALFAFRENS_API_URL = originalEnv;
        });
    });
}); 