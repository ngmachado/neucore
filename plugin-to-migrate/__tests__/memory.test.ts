import { describe, it, expect } from 'vitest';
import { createAlfaFrensMemory } from '../src/memory';
import { stringToUuid, IAgentRuntime, UUID } from '@elizaos/core';
import type { AlfaFrensMessage } from '../src/types';

describe('createAlfaFrensMemory', () => {
    const mockRuntime = {
        agentId: 'test-agent-id'
    } as unknown as IAgentRuntime;

    const mockMessage: AlfaFrensMessage = {
        id: 'test-message-id',
        content: 'Hello world',
        senderId: 'test-sender-id',
        senderUsername: 'test-user',
        timestamp: '2024-03-27T00:00:00Z'
    };

    const TEST_ROOM_ID: UUID = '123e4567-e89b-12d3-a456-426614174000';
    const TEST_USER_ID: UUID = '123e4567-e89b-12d3-a456-426614174001';

    it('should create a memory object from a user message', () => {
        const memory = createAlfaFrensMemory({
            roomId: TEST_ROOM_ID,
            senderId: TEST_USER_ID,
            runtime: mockRuntime,
            message: mockMessage
        });

        expect(memory).toEqual({
            id: stringToUuid('test-message-id'),
            userId: TEST_USER_ID,
            agentId: 'test-agent-id',
            content: {
                text: 'Hello world',
                source: 'alfafrens',
                sourceUserId: 'test-sender-id',
                sourceUserName: 'test-user',
                inReplyTo: undefined
            },
            roomId: TEST_ROOM_ID
        });
    });

    it('should create a memory object from a bot message', () => {
        const memory = createAlfaFrensMemory({
            roomId: TEST_ROOM_ID,
            senderId: TEST_USER_ID,
            runtime: mockRuntime,
            message: mockMessage,
            isBotMessage: true
        });

        expect(memory).toEqual({
            id: stringToUuid('test-message-id'),
            userId: stringToUuid('test-sender-id'),
            agentId: 'test-agent-id',
            content: {
                text: 'Hello world',
                source: 'alfafrens',
                sourceUserId: 'test-sender-id',
                sourceUserName: 'test-user',
                inReplyTo: undefined
            },
            roomId: TEST_ROOM_ID
        });
    });

    it('should handle reply messages', () => {
        const replyMessage = {
            ...mockMessage,
            replyTo: 'original-message-id'
        };

        const memory = createAlfaFrensMemory({
            roomId: TEST_ROOM_ID,
            senderId: TEST_USER_ID,
            runtime: mockRuntime,
            message: replyMessage
        });

        expect(memory).toEqual({
            id: stringToUuid('test-message-id'),
            userId: TEST_USER_ID,
            agentId: 'test-agent-id',
            content: {
                text: 'Hello world',
                source: 'alfafrens',
                sourceUserId: 'test-sender-id',
                sourceUserName: 'test-user',
                inReplyTo: stringToUuid('original-message-id')
            },
            roomId: TEST_ROOM_ID
        });
    });
}); 