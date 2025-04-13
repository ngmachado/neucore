import { Memory, IAgentRuntime, stringToUuid, UUID } from "@elizaos/core";
import type { AlfaFrensMessage } from "./types";

/**
 * create a memory for an AlfaFrens message
 * @param params memory parameters
 * @returns created memory
 */
export function createAlfaFrensMemory(params: {
    roomId: UUID;
    senderId: UUID;
    runtime: IAgentRuntime;
    message: AlfaFrensMessage;
    isBotMessage: boolean;
}): Memory {
    return {
        id: params.message.id as UUID,
        userId: params.senderId,
        agentId: params.runtime.agentId,
        content: {
            text: params.message.content || "",
            action: params.isBotMessage ? "ALFAFRENS_SEND_MESSAGE" : undefined
        },
        roomId: params.roomId
    };
} 