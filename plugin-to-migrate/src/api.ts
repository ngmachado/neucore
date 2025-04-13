import { AlfaFrensMessage, AlfaFrensSendMessageResponse } from "./types";
import { elizaLogger } from "@elizaos/core";

/**
 * AlfaFrens API client - handles HTTP communication with the AlfaFrens API
 */
export class AlfaFrensApi {
    private baseUrl: string;

    constructor(
        private apiKey: string,
        private channelId: string,
        baseUrl?: string
    ) {
        elizaLogger.debug("[AlfaFrensApi] constructor called with channelId:", channelId);
        this.baseUrl = baseUrl || process.env.ALFAFRENS_API_URL || "https://friendx-git-ai-api.preview.superfluid.finance";
        elizaLogger.debug("[AlfaFrensApi] using baseUrl:", this.baseUrl);
    }

    private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
        elizaLogger.debug("[AlfaFrensApi] fetch called with path:", path);
        const response = await fetch(`${this.baseUrl}${path}`, {
            ...options,
            headers: {
                "x-api-key": this.apiKey,
                "Content-Type": "application/json",
                ...options.headers
            }
        });

        elizaLogger.debug("[AlfaFrensApi] fetch response status:", response.status);
        if (!response.ok) {
            const errorText = await response.text();
            console.error("[AlfaFrensApi] API Error:", {
                status: response.status,
                statusText: response.statusText,
                body: errorText
            });
            throw new Error(`API request failed: ${response.statusText}`);
        }

        const data = await response.json();
        elizaLogger.debug("[AlfaFrensApi] fetch response data type:", Array.isArray(data) ? `Array[${data.length}]` : typeof data);
        return data;
    }

    /**
     * Gets messages from the channel
     * @param options Options for fetching messages
     * @returns Array of messages
     */
    async getMessages(options: {
        since?: number;
        until?: number;
        includeReactions?: boolean;
        includeReplies?: boolean;
    } = {}): Promise<AlfaFrensMessage[]> {
        elizaLogger.debug("[AlfaFrensApi] getMessages called with options:", options);
        try {
            // Build URL with since parameter
            let url = `/api/ai/getChannelMessages?since=${options.since || Date.now() - 3600000}`;

            // Add until parameter if provided
            if (options.until) {
                url += `&until=${options.until}`;
            }

            // Add include parameter for reactions and replies
            if (options.includeReactions || options.includeReplies) {
                let includeValues = [];

                if (options.includeReactions) {
                    includeValues.push("reactions");
                }

                if (options.includeReplies) {
                    // Always include reactions when including replies for proper display
                    includeValues = ["reactions", "replies"];
                }

                if (includeValues.length > 0) {
                    url += "&include=" + includeValues.join(",");
                }
            }

            elizaLogger.debug("[AlfaFrensApi] Fetching messages with URL:", url);

            // The API returns an array directly
            const response = await this.fetch<AlfaFrensMessage[]>(url);

            if (response.length > 0) {
                elizaLogger.debug(`[AlfaFrensApi] Retrieved ${response.length} messages`);
            }

            return response;
        } catch (error) {
            console.error("[AlfaFrensApi] Error retrieving messages:", error);
            elizaLogger.error("[AlfaFrensApi] Failed to get messages:", error);
            throw error;
        }
    }

    /**
     * Sends a new message to the channel
     * @param content Message content
     * @returns Response object with message ID and timestamp
     */
    async sendMessage(content: string): Promise<AlfaFrensSendMessageResponse> {
        return this.sendMessageWithOptions(content);
    }

    /**
     * Replies to an existing message in the channel
     * @param content Reply content
     * @param replyToPostId ID of the message to reply to
     * @returns Response object with message ID and timestamp
     */
    async replyMessage(content: string, replyToPostId: string): Promise<AlfaFrensSendMessageResponse> {
        return this.sendMessageWithOptions(content, replyToPostId);
    }

    /**
     * Creates a new post in the channel
     * @param content Post content
     * @returns Response object with message ID and timestamp
     */
    async createPost(content: string): Promise<AlfaFrensSendMessageResponse> {
        return this.sendMessageWithOptions(content);
    }

    /**
     * Internal method to send messages with options
     */
    private async sendMessageWithOptions(content: string, replyTo?: string): Promise<AlfaFrensSendMessageResponse> {
        try {
            const payload: any = {
                content: content.trim()
            };

            if (replyTo) {
                payload.replyToPostId = replyTo;
            }

            const response = await this.fetch<AlfaFrensSendMessageResponse>('/api/ai/postMessage', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            return response;
        } catch (error) {
            console.error('[AlfaFrensApi] Error sending message:', error);
            throw error;
        }
    }
} 