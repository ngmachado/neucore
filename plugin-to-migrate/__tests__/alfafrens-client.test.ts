import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AlfaFrensManager } from '../src/alfafrens-client';
import { IAgentRuntime } from '@elizaos/core';
import { AlfaFrensApi } from '../src/api';
import { AlfaFrensAIInteraction } from '../src/extensions/ai-interaction';
import { AlfaFrensMessage } from '../src/types';

// Mock dependencies
vi.mock('../src/api');
vi.mock('../src/extensions/ai-interaction');

describe('AlfaFrensManager', () => {
    let mockRuntime: IAgentRuntime;
    let manager: AlfaFrensManager;

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        // Create mock runtime
        mockRuntime = {
            getSetting: vi.fn((key: string) => {
                const settings: Record<string, string> = {
                    'ALFAFRENS_API_KEY': 'test-api-key',
                    'ALFAFRENS_USER_ID': 'test-user',
                    'ALFAFRENS_CHANNEL_ID': 'test-channel',
                    'ALFAFRENS_USERNAME': 'Test Bot',
                    'ALFAFRENS_POLL_INTERVAL': '15',
                    'ALFAFRENS_ENABLE_POST': 'true',
                    'ALFAFRENS_POST_INTERVAL_MIN': '3600',
                    'ALFAFRENS_POST_INTERVAL_MAX': '7200'
                };
                return settings[key] || null;
            }),
            cacheManager: {
                get: vi.fn(),
                set: vi.fn()
            }
        } as unknown as IAgentRuntime;

        // Create manager instance
        manager = new AlfaFrensManager(mockRuntime);
    });

    describe('constructor', () => {
        it('should initialize with correct config', () => {
            expect(manager.config).toEqual({
                apiKey: 'test-api-key',
                userId: 'test-user',
                channelId: 'test-channel',
                username: 'Test Bot',
                pollInterval: 15,
                enablePost: true,
                postIntervalMin: 3600,
                postIntervalMax: 7200
            });
        });

        it('should throw error when API key is missing', () => {
            const invalidRuntime = {
                getSetting: vi.fn(() => null)
            } as unknown as IAgentRuntime;

            expect(() => new AlfaFrensManager(invalidRuntime)).toThrow('AlfaFrens API key is required');
        });
    });

    describe('initialize', () => {
        it('should initialize successfully', async () => {
            await manager.initialize(mockRuntime);
            expect(manager.isRunning).toBe(true);
            expect(manager.aiInteraction?.start).toHaveBeenCalledWith(15);
        });

        it('should not initialize if already running', async () => {
            manager.isRunning = true;
            await manager.initialize(mockRuntime);
            expect(manager.aiInteraction?.start).not.toHaveBeenCalled();
        });

        it('should handle initialization errors', async () => {
            vi.mocked(manager.aiInteraction!.start).mockRejectedValueOnce(new Error('Start failed'));

            await expect(manager.initialize(mockRuntime)).rejects.toThrow('Start failed');
            expect(manager.isRunning).toBe(false);
        });
    });

    describe('stop', () => {
        it('should stop successfully', async () => {
            manager.isRunning = true;
            await manager.stop(mockRuntime);
            expect(manager.isRunning).toBe(false);
            expect(manager.aiInteraction?.stop).toHaveBeenCalled();
            expect(mockRuntime.cacheManager.set).toHaveBeenCalledWith('alfafrens_last_processed_time', expect.any(Number));
        });

        it('should not stop if not running', async () => {
            manager.isRunning = false;
            await manager.stop(mockRuntime);
            expect(manager.aiInteraction?.stop).not.toHaveBeenCalled();
        });

        it('should handle stop errors', async () => {
            manager.isRunning = true;
            vi.mocked(manager.aiInteraction!.stop).mockRejectedValueOnce(new Error('Stop failed'));

            await expect(manager.stop(mockRuntime)).rejects.toThrow('Stop failed');
        });
    });

    describe('message handling', () => {
        it('should get messages successfully', async () => {
            const mockMessages: AlfaFrensMessage[] = [
                {
                    id: '1',
                    content: 'Hello',
                    timestamp: Date.now().toString(),
                    senderId: 'test-sender',
                    senderUsername: 'Test User'
                }
            ];
            vi.mocked(AlfaFrensApi.prototype.getMessages).mockResolvedValueOnce(mockMessages);

            const messages = await manager.getMessages({
                roomId: 'test-room',
                since: 0,
                until: Date.now(),
                includeReplies: true
            });

            expect(messages).toEqual(mockMessages);
        });

        it('should handle message retrieval errors', async () => {
            vi.mocked(AlfaFrensApi.prototype.getMessages).mockRejectedValueOnce(new Error('API error'));

            await expect(manager.getMessages({
                roomId: 'test-room'
            })).rejects.toThrow('API error');
        });
    });
}); 