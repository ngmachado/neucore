import { describe, it, expect, vi } from 'vitest';
import { sendAlfaFrensMessageAction, createAlfaFrensPostAction } from '../src/actions';
import { IAgentRuntime, Memory } from '@elizaos/core';
import { AlfaFrensManager } from '../src/alfafrens-client';

describe('AlfaFrens Actions', () => {
    describe('sendAlfaFrensMessageAction', () => {
        it('should validate correct action name', async () => {
            const message: Memory = {
                content: {
                    action: 'alfafrens_send_message',
                    text: 'Hello world'
                }
            } as Memory;

            const result = await sendAlfaFrensMessageAction.validate({} as IAgentRuntime, message);
            expect(result).toBe(true);
        });

        it('should reject incorrect action name', async () => {
            const message: Memory = {
                content: {
                    action: 'wrong_action',
                    text: 'Hello world'
                }
            } as Memory;

            const result = await sendAlfaFrensMessageAction.validate({} as IAgentRuntime, message);
            expect(result).toBe(false);
        });

        it('should handle missing client gracefully', async () => {
            const message: Memory = {
                content: {
                    action: 'alfafrens_send_message',
                    text: 'Hello world'
                }
            } as Memory;

            const mockRuntime = {
                clients: []
            } as unknown as IAgentRuntime;

            const result = await sendAlfaFrensMessageAction.handler(mockRuntime, message);
            expect(result).toEqual({
                text: 'AlfaFrens client is not running. Make sure it\'s enabled in your character config.',
                error: true
            });
        });
    });

    describe('createAlfaFrensPostAction', () => {
        it('should validate correct action name', async () => {
            const message: Memory = {
                content: {
                    action: 'alfafrens_create_post',
                    text: 'New post content'
                }
            } as Memory;

            const result = await createAlfaFrensPostAction.validate({} as IAgentRuntime, message);
            expect(result).toBe(true);
        });

        it('should reject incorrect action name', async () => {
            const message: Memory = {
                content: {
                    action: 'wrong_action',
                    text: 'New post content'
                }
            } as Memory;

            const result = await createAlfaFrensPostAction.validate({} as IAgentRuntime, message);
            expect(result).toBe(false);
        });

        it('should handle missing client gracefully', async () => {
            const message: Memory = {
                content: {
                    action: 'alfafrens_create_post',
                    text: 'New post content'
                }
            } as Memory;

            const mockRuntime = {
                clients: []
            } as unknown as IAgentRuntime;

            const result = await createAlfaFrensPostAction.handler(mockRuntime, message);
            expect(result).toEqual({
                text: 'AlfaFrens client is not running. Make sure it\'s enabled in your character config.',
                error: true
            });
        });
    });
}); 