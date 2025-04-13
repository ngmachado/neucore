import { IAgentRuntime, elizaLogger, ModelClass } from "@elizaos/core";
import { AlfaFrensManager } from "../alfafrens-client";
import {
    DEFAULT_POST_TEMPLATE,
    generatePostContent,
    getNumericSetting,
    parseModelClass
} from "./utils";
import type { AlfaFrensGenerationConfig } from "../types";
import { AlfaFrensTaskManager } from "./tasks";

/**
 * options for configuring the AI post generator
 */
export interface AlfaFrensAIPostOptions {
    /** template for generating post content */
    postTemplate?: string;
    /** model class to use for generation */
    modelClass?: ModelClass;
    /** interval between posts in seconds */
    intervalSeconds?: number;
}

/**
 * an extension for generating AI-powered posts for AlfaFrens
 */
export class AlfaFrensAIPost {
    private runtime: IAgentRuntime;
    private client: AlfaFrensManager;
    private interval?: NodeJS.Timeout;
    private isRunning: boolean = false;
    private options: AlfaFrensAIPostOptions;
    private lastPostTime: number = 0;
    private taskManager: AlfaFrensTaskManager;

    /**
     * creates a new AI post generator
     * @param client the AlfaFrens client manager
     * @param runtime the agent runtime
     * @param options optional configuration options
     */
    constructor(
        client: AlfaFrensManager,
        runtime: IAgentRuntime,
        options: AlfaFrensAIPostOptions = {}
    ) {
        this.client = client;
        this.runtime = runtime;
        this.options = options;
        this.taskManager = new AlfaFrensTaskManager(runtime);
    }

    /**
     * start the automated posting service
     * @param intervalSeconds optional override for seconds between posts (default from options or 3600)
     */
    async start(intervalSeconds?: number): Promise<void> {
        if (this.isRunning) {
            elizaLogger.debug("[AlfaFrensAIPost] already running, returning early");
            return;
        }
        this.isRunning = true;

        const interval = intervalSeconds ||
            this.options.intervalSeconds ||
            getNumericSetting(this.runtime, "ALFAFRENS_POST_INTERVAL_SECONDS", 3600);

        elizaLogger.debug("[AlfaFrensAIPost] using interval:", interval, "seconds");
        elizaLogger.info(`[AlfaFrensAIPost] Starting AI post generator with interval: ${interval}s`);

        // create posting task
        await this.taskManager.createAIInteractionTask("POST", interval * 1000);
    }

    /**
     * stop the automated posting service
     */
    async stop(): Promise<void> {
        if (!this.isRunning) {
            elizaLogger.debug("[AlfaFrensAIPost] already stopped");
            return;
        }

        elizaLogger.info("[AlfaFrensAIPost] Stopping AI post generator");
        this.isRunning = false;

        // process any remaining tasks
        await this.taskManager.processTasks();
    }

    /**
     * generate and create a new post
     * @param customContent optional custom content to post
     * @returns the created post
     */
    private async createPost(customContent?: string): Promise<any> {
        try {
            elizaLogger.info("[AlfaFrensAIPost] Starting post creation");
            const content = customContent || await this.generatePostContent();
            elizaLogger.info("[AlfaFrensAIPost] Generated post content:", {
                contentLength: content.length,
                content: content
            });

            // format content
            const formattedContent = content;

            const result = await this.client.createPost({
                content: formattedContent,
                roomId: this.client.config.channelId
            });

            elizaLogger.info("[AlfaFrensAIPost] Post created successfully:", {
                messageId: result[0].message.id,
                timestamp: result[0].message.timestamp
            });
            return result;
        } catch (error) {
            elizaLogger.error("[AlfaFrensAIPost] Failed to create post:", error);
            throw error;
        }
    }

    /**
     * generate content for a post using the AI
     * @param customTemplate optional override template for this specific generation
     * @returns generated post content
     */
    private async generatePostContent(customTemplate?: string): Promise<string> {
        const config: AlfaFrensGenerationConfig['post'] = {
            template: customTemplate || this.options.postTemplate || DEFAULT_POST_TEMPLATE,
            modelClass: this.options.modelClass || parseModelClass(this.runtime.getSetting("ALFAFRENS_POST_MODEL_CLASS"))
        };

        return generatePostContent(this.runtime, config);
    }
} 