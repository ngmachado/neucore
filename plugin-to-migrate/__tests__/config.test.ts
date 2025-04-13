import { describe, it, expect } from 'vitest';
import { loadAlfaFrensConfig } from '../src/config';
import { IAgentRuntime, ModelClass } from '@elizaos/core';
import { DEFAULT_POST_TEMPLATE, DEFAULT_RESPONSE_TEMPLATE, DEFAULT_EVALUATION_TEMPLATE } from '../src/extensions/utils';

describe('Config utilities', () => {
    describe('loadAlfaFrensConfig', () => {
        it('should load default config when no settings are provided', () => {
            const mockRuntime = {
                getSetting: () => null
            } as unknown as IAgentRuntime;

            const config = loadAlfaFrensConfig(mockRuntime);

            expect(config).toEqual({
                post: {
                    template: DEFAULT_POST_TEMPLATE,
                    modelClass: ModelClass.SMALL
                },
                response: {
                    template: DEFAULT_RESPONSE_TEMPLATE,
                    modelClass: ModelClass.SMALL
                },
                evaluation: {
                    template: DEFAULT_EVALUATION_TEMPLATE,
                    modelClass: ModelClass.SMALL
                }
            });
        });

        it('should load custom config from runtime settings', () => {
            const mockRuntime = {
                getSetting: (key: string) => {
                    const settings: Record<string, string> = {
                        'ALFAFRENS_POST_TEMPLATE': 'custom post template',
                        'ALFAFRENS_POST_MODEL_CLASS': 'LARGE',
                        'ALFAFRENS_RESPONSE_TEMPLATE': 'custom response template',
                        'ALFAFRENS_RESPONSE_MODEL_CLASS': 'MEDIUM',
                        'ALFAFRENS_EVALUATION_TEMPLATE': 'custom eval template',
                        'ALFAFRENS_EVALUATION_MODEL_CLASS': 'SMALL'
                    };
                    return settings[key] || null;
                }
            } as unknown as IAgentRuntime;

            const config = loadAlfaFrensConfig(mockRuntime);

            expect(config).toEqual({
                post: {
                    template: 'custom post template',
                    modelClass: ModelClass.LARGE
                },
                response: {
                    template: 'custom response template',
                    modelClass: ModelClass.MEDIUM
                },
                evaluation: {
                    template: 'custom eval template',
                    modelClass: ModelClass.SMALL
                }
            });
        });

        it('should handle mixed custom and default values', () => {
            const mockRuntime = {
                getSetting: (key: string) => {
                    const settings: Record<string, string> = {
                        'ALFAFRENS_POST_TEMPLATE': 'custom post template',
                        'ALFAFRENS_EVALUATION_MODEL_CLASS': 'LARGE'
                    };
                    return settings[key] || null;
                }
            } as unknown as IAgentRuntime;

            const config = loadAlfaFrensConfig(mockRuntime);

            expect(config).toEqual({
                post: {
                    template: 'custom post template',
                    modelClass: ModelClass.SMALL
                },
                response: {
                    template: DEFAULT_RESPONSE_TEMPLATE,
                    modelClass: ModelClass.SMALL
                },
                evaluation: {
                    template: DEFAULT_EVALUATION_TEMPLATE,
                    modelClass: ModelClass.LARGE
                }
            });
        });

        it('should handle invalid model class values', () => {
            const mockRuntime = {
                getSetting: (key: string) => {
                    const settings: Record<string, string> = {
                        'ALFAFRENS_POST_MODEL_CLASS': 'INVALID',
                        'ALFAFRENS_RESPONSE_MODEL_CLASS': 'XL',
                        'ALFAFRENS_EVALUATION_MODEL_CLASS': ''
                    };
                    return settings[key] || null;
                }
            } as unknown as IAgentRuntime;

            const config = loadAlfaFrensConfig(mockRuntime);

            expect(config).toEqual({
                post: {
                    template: DEFAULT_POST_TEMPLATE,
                    modelClass: ModelClass.SMALL
                },
                response: {
                    template: DEFAULT_RESPONSE_TEMPLATE,
                    modelClass: ModelClass.SMALL
                },
                evaluation: {
                    template: DEFAULT_EVALUATION_TEMPLATE,
                    modelClass: ModelClass.SMALL
                }
            });
        });
    });
}); 