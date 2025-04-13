import { ModelClass } from "@elizaos/core";

/**
 * configuration for AlfaFrens client
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
}

/**
 * message from AlfaFrens API
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
 * Response from sending a message
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
 * Options for getting messages
 */
export interface GetMessagesOptions {
    /** Get messages since this timestamp */
    since?: number;
    /** Get messages until this timestamp */
    until?: number;
    /** Include reactions in the response */
    includeReactions?: boolean;
    /** Include replies in the response */
    includeReplies?: boolean;
}

export interface AlfaFrensReaction {
    emoji: string;
    count: number;
}

export interface AlfaFrensReplyTo {
    id: string;
    senderUsername: string;
    content: string;
}

/**
 * memory content for AlfaFrens messages
 */
export interface AlfaFrensMemoryContent {
    /** message text */
    text: string;
    /** action to take */
    action?: string;
    /** ID of the message being replied to */
    inReplyTo?: string;
    /** source of the message */
    source?: string;
    /** user ID of the source */
    sourceUserId?: string;
    /** username of the source */
    sourceUserName?: string;
}

/**
 * generation configuration for AI operations
 */
export interface AlfaFrensGenerationConfig {
    /** configuration for message evaluation */
    evaluation: {
        /** template for evaluation */
        template: string;
        /** model class to use */
        modelClass?: ModelClass;
    };
    /** configuration for response generation */
    response: {
        /** template for response */
        template: string;
        /** model class to use */
        modelClass?: ModelClass;
    };
    /** configuration for post generation */
    post: {
        /** template for post */
        template: string;
        /** model class to use */
        modelClass?: ModelClass;
    };
}

export interface AlfaFrensClient {
    sendMessage(params: {
        content: string;
        roomId: string;
        inReplyTo?: string;
    }): Promise<{ memory: any; message: AlfaFrensMessage }[]>;

    createPost(params: {
        content: string;
        roomId: string;
    }): Promise<{ memory: any; message: AlfaFrensMessage }[]>;

    getMessages(params: {
        roomId: string;
        since?: number;
        until?: number;
        includeReplies?: boolean;
    }): Promise<AlfaFrensMessage[]>;
} 