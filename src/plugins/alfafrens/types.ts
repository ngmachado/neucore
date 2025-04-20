/**
 * Message from Alfafrens platform
 */
export interface AlfaFrensMessage {
    /** unique message ID */
    id: string;
    /** ID of the message sender */
    senderId: string;
    /** username of the message sender */
    senderUsername: string;
    /** message content */
    content: string;
    /** timestamp of the message */
    timestamp: string;
    /** ID of the message being replied to */
    replyTo?: string;
    /** Optional reactions to this message */
    reactions?: Array<{
        emoji: string;
        count: number;
        userIds: string[];
    }>;
}

/**
 * Response from sending a message to Alfafrens
 */
export interface AlfaFrensSendMessageResponse {
    /** Status of the request (success, error) */
    status: string;
    /** Unique ID of the created message */
    messageId: string;
    /** Timestamp when the message was created */
    timestamp: string;
}

/**
 * Test message structure
 */
export interface TestMessage {
    id: string;
    senderId: string;
    senderUsername: string;
    content: string;
    timestamp: string;
    replyTo?: string;
}

/**
 * Configuration for the Alfafrens plugin
 */
export interface AlfaFrensConfig {
    /** API key for authentication */
    apiKey: string;
    /** user ID for the bot */
    userId: string;
    /** channel ID to interact with */
    channelId: string;
    /** username for the bot */
    username: string;
    /** interval between polling for messages in seconds */
    pollInterval: number;
    /** whether to enable automated posting */
    enablePost: boolean;
    /** minimum interval between posts in seconds */
    postIntervalMin: number;
    /** maximum interval between posts in seconds */
    postIntervalMax: number;
    /** test server configuration */
    testServer?: TestServerConfig;
}

/**
 * Test server configuration
 */
export interface TestServerConfig {
    port: number;
    enabled: boolean;
} 