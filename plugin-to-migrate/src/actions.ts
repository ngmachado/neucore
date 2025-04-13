import { IAgentRuntime, elizaLogger, Action, Memory } from "@elizaos/core";
import { AlfaFrensManager } from "./alfafrens-client";
import type { AlfaFrensMemoryContent } from "./types";

/**
 * sends a message to the AlfaFrens channel
 */
export const sendAlfaFrensMessageAction: Action = {
    name: "ALFAFRENS_SEND_MESSAGE",
    description: "sends a message to the AlfaFrens channel",
    similes: ["send", "message", "chat", "respond"],
    examples: [[
        {
            user: "user",
            content: {
                text: "send a message to AlfaFrens",
                action: "ALFAFRENS_SEND_MESSAGE"
            }
        }
    ]],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const content = message.content as AlfaFrensMemoryContent;
        if (!content?.text) {
            elizaLogger.error("[AlfaFrens] message content is missing");
            return false;
        }
        return true;
    },
    handler: async (runtime: IAgentRuntime, message: Memory) => {
        const content = message.content as AlfaFrensMemoryContent;
        const client = runtime.clients.find(c => c.constructor.name === "AlfaFrensManager") as AlfaFrensManager;
        if (!client) {
            elizaLogger.error("[AlfaFrens] client not found");
            return false;
        }

        try {
            await client.sendMessage({
                content: content.text,
                roomId: client.config.channelId
            });
            return true;
        } catch (error) {
            elizaLogger.error("[AlfaFrens] failed to send message:", error);
            return false;
        }
    }
};

/**
 * creates a new post in the AlfaFrens channel
 */
export const createAlfaFrensPostAction: Action = {
    name: "ALFAFRENS_CREATE_POST",
    description: "creates a new post in the AlfaFrens channel",
    similes: ["post", "share", "announce", "publish"],
    examples: [[
        {
            user: "user",
            content: {
                text: "create a post in AlfaFrens",
                action: "ALFAFRENS_CREATE_POST"
            }
        }
    ]],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const content = message.content as AlfaFrensMemoryContent;
        if (!content?.text) {
            elizaLogger.error("[AlfaFrens] post content is missing");
            return false;
        }
        return true;
    },
    handler: async (runtime: IAgentRuntime, message: Memory) => {
        const content = message.content as AlfaFrensMemoryContent;
        const client = runtime.clients.find(c => c.constructor.name === "AlfaFrensManager") as AlfaFrensManager;
        if (!client) {
            elizaLogger.error("[AlfaFrens] client not found");
            return false;
        }

        try {
            await client.createPost({
                content: content.text,
                roomId: client.config.channelId
            });
            return true;
        } catch (error) {
            elizaLogger.error("[AlfaFrens] failed to create post:", error);
            return false;
        }
    }
};

// export all actions
export const actions = [
    sendAlfaFrensMessageAction,
    createAlfaFrensPostAction
]; 