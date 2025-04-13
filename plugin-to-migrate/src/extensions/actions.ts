import { IAgentRuntime, elizaLogger, Action, Memory } from "@elizaos/core";
import { AlfaFrensManager } from "../alfafrens-client";
import { generatePostContent, generateResponse } from "./utils";
import { loadAlfaFrensConfig } from "../config";
import type { AlfaFrensMessage, AlfaFrensMemoryContent } from "../types";

/**
 * gets message history for a conversation
 */
async function getMessageHistory(
    client: AlfaFrensManager,
    message: Memory,
    maxHistory: number = 5
): Promise<AlfaFrensMessage[]> {
    try {
        const content = message.content as AlfaFrensMemoryContent;
        const replyTo = content.inReplyTo;

        if (!replyTo) {
            return [];
        }

        const messages = await client.getMessages({
            roomId: client.config.channelId,
            until: Date.now(),
            includeReplies: true
        });

        // filter messages to get the conversation thread
        const thread: AlfaFrensMessage[] = [];
        let currentMessage = messages.find(m => m.id === replyTo);

        while (currentMessage && thread.length < maxHistory) {
            thread.unshift(currentMessage);
            if (currentMessage.replyTo) {
                currentMessage = messages.find(m => m.id === currentMessage.replyTo);
            } else {
                break;
            }
        }

        return thread;
    } catch (error) {
        elizaLogger.error("[AlfaFrensAction] failed to get message history:", error);
        return [];
    }
}

/**
 * creates AlfaFrens actions that can be registered with the ElizaOS runtime
 */
export function createAlfaFrensActions(
    client: AlfaFrensManager,
    runtime: IAgentRuntime
): Action[] {
    const config = loadAlfaFrensConfig(runtime);

    return [
        {
            name: "ALFAFRENS_CREATE_POST",
            description: "creates a new post in the AlfaFrens channel",
            similes: ["post", "share", "announce", "publish"],
            examples: [
                [
                    {
                        user: "{{user1}}",
                        content: { text: "create a new post about community updates" }
                    },
                    {
                        user: "{{user2}}",
                        content: { text: "Exciting new features coming to our platform! Stay tuned for updates.", action: "ALFAFRENS_CREATE_POST" }
                    }
                ]
            ],
            validate: async (_runtime: IAgentRuntime, _message: Memory) => {
                return true;
            },
            handler: async (runtime: IAgentRuntime, message: Memory) => {
                try {
                    const content = (message.content as AlfaFrensMemoryContent).text ||
                        await generatePostContent(runtime, config.post);

                    elizaLogger.debug("[AlfaFrensAction] creating post with content:", content);
                    await client.createPost({
                        content,
                        roomId: client.config.channelId
                    });

                    elizaLogger.info("[AlfaFrensAction] post created successfully");
                    return true;
                } catch (error) {
                    elizaLogger.error("[AlfaFrensAction] failed to create post:", error);
                    return false;
                }
            }
        },
        {
            name: "ALFAFRENS_RESPOND",
            description: "responds to a message in the AlfaFrens channel",
            similes: ["reply", "answer", "respond"],
            examples: [
                [
                    {
                        user: "{{user1}}",
                        content: { text: "What's the latest update?" }
                    },
                    {
                        user: "{{user2}}",
                        content: { text: "We've just launched new features! Check them out.", action: "ALFAFRENS_RESPOND" }
                    }
                ]
            ],
            validate: async (_runtime: IAgentRuntime, _message: Memory) => {
                return true;
            },
            handler: async (runtime: IAgentRuntime, message: Memory) => {
                try {
                    const content = message.content as AlfaFrensMemoryContent;
                    const history = await getMessageHistory(client, message);

                    const responseContent = content.text || await generateResponse(
                        runtime,
                        client,
                        content.text || "",
                        history,
                        config.response.template,
                        config.response.modelClass
                    );

                    elizaLogger.debug("[AlfaFrensAction] sending response:", {
                        contentLength: responseContent.length,
                        replyTo: content.inReplyTo
                    });

                    await client.sendMessage({
                        content: responseContent,
                        roomId: client.config.channelId,
                        inReplyTo: content.inReplyTo
                    });

                    elizaLogger.info("[AlfaFrensAction] response sent successfully");
                    return true;
                } catch (error) {
                    elizaLogger.error("[AlfaFrensAction] failed to send response:", error);
                    return false;
                }
            }
        }
    ];
}

/**
 * registers AlfaFrens actions with the ElizaOS runtime
 */
export function registerAlfaFrensActions(
    client: AlfaFrensManager,
    runtime: IAgentRuntime
): void {
    const actions = createAlfaFrensActions(client, runtime);

    elizaLogger.debug(`[AlfaFrensActions] registering ${actions.length} actions`);

    actions.forEach(action => {
        runtime.registerAction(action);
    });

    elizaLogger.info("[AlfaFrensActions] actions registered successfully");
} 