import { IAgentRuntime, Memory, elizaLogger, UUID, State } from "@elizaos/core";
import { AlfaFrensMessage } from "../types";
import { FactValidationManager } from "./fact-validation";
import { v4 as uuidv4 } from "uuid";

// Import Task and TaskWorker types from ElizaOS core
interface Task {
    id?: UUID;
    name: string;
    description: string;
    roomId?: UUID;
    worldId?: UUID;
    tags: string[];
    metadata?: {
        updateInterval?: number;
        options?: {
            name: string;
            description: string;
        }[];
        [key: string]: unknown;
    };
}

interface TaskWorker {
    name: string;
    execute: (
        runtime: IAgentRuntime,
        options: { [key: string]: unknown },
        task: Task
    ) => Promise<void>;
    validate?: (
        runtime: IAgentRuntime,
        message: Memory,
        state: State
    ) => Promise<boolean>;
}

interface FactValidationTask extends Task {
    name: "FACT_VALIDATION";
    metadata: {
        fact: string;
        source: string;
        requiresConfirmation?: boolean;
        scheduledFor?: number;
        validation?: {
            confidence: number;
            contradictions: string[];
        };
    };
}

interface AIInteractionTask extends Task {
    name: "AI_INTERACTION";
    metadata: {
        type: "POLL" | "POST" | "RESPONSE";
        interval: number;
        lastProcessed: number;
        messageId?: string;
    };
}

/**
 * Simple task definition
 */
export interface SimpleTask {
    id: string;
    name: string;
    type: "POLL" | "POST" | "RESPONSE";
    interval: number;
    lastRun: number;
    handler: () => Promise<void>;
}

/**
 * Simplified task manager that doesn't rely on ElizaOS runtime task methods
 */
export class AlfaFrensTaskManager {
    private runtime: IAgentRuntime;
    private factValidationManager: FactValidationManager;
    private tasks: Map<string, SimpleTask> = new Map();
    private intervals: Map<string, NodeJS.Timeout> = new Map();
    private isRunning: boolean = false;

    constructor(runtime: IAgentRuntime) {
        this.runtime = runtime;
        this.factValidationManager = new FactValidationManager(runtime);
        elizaLogger.debug("[AlfaFrensTaskManager] Initialized");
    }

    private registerTaskWorkers(): void {
        // Fact Validation Worker
        (this.runtime as any).registerTaskWorker({
            name: "FACT_VALIDATION",
            validate: async (runtime, message, state) => {
                // Only validate facts from non-bot users
                return message.userId !== runtime.agentId;
            },
            execute: async (runtime, options, task) => {
                const factTask = task as FactValidationTask;
                const validation = await this.factValidationManager.validateFact(
                    factTask.metadata.fact,
                    {
                        id: task.id,
                        timestamp: new Date().toISOString(),
                        senderId: factTask.metadata.source,
                        senderUsername: factTask.metadata.source,
                        content: factTask.metadata.fact
                    }
                );

                if (validation.confidence >= 0.7) {
                    await this.factValidationManager.storeFact(
                        factTask.metadata.fact,
                        validation
                    );
                }

                // Delete the task after completion
                await (runtime as any).deleteTask(task.id);
            }
        });

        // AI Interaction Worker
        (this.runtime as any).registerTaskWorker({
            name: "AI_INTERACTION",
            validate: async (runtime, message, state) => {
                const task = await (runtime as any).getTask(message.id);
                if (!task) return false;

                const interactionTask = task as AIInteractionTask;
                const now = Date.now();
                return now - interactionTask.metadata.lastProcessed >= interactionTask.metadata.interval;
            },
            execute: async (runtime, options, task) => {
                const interactionTask = task as AIInteractionTask;

                switch (interactionTask.metadata.type) {
                    case "POLL":
                        // Handle message polling
                        break;
                    case "POST":
                        // Handle content posting
                        break;
                    case "RESPONSE":
                        // Handle response generation
                        break;
                }

                // Update last processed time
                await (runtime as any).updateTask(task.id, {
                    metadata: {
                        ...interactionTask.metadata,
                        lastProcessed: Date.now()
                    }
                });
            }
        });
    }

    async createFactValidationTask(
        fact: string,
        source: string,
        options: {
            deferred?: boolean;
            requiresConfirmation?: boolean;
        } = {}
    ): Promise<FactValidationTask> {
        const task: FactValidationTask = {
            name: "FACT_VALIDATION",
            description: `Validate fact: ${fact}`,
            tags: ["fact-validation"],
            metadata: {
                fact,
                source,
                requiresConfirmation: options.requiresConfirmation,
                scheduledFor: options.deferred ? Date.now() + 3600000 : undefined // 1 hour delay if deferred
            }
        };

        return (this.runtime as any).createTask(task) as Promise<FactValidationTask>;
    }

    /**
     * Create a task for AI interaction
     */
    async createAIInteractionTask(
        type: "POLL" | "POST" | "RESPONSE",
        interval: number,
        handler?: () => Promise<void>
    ): Promise<SimpleTask> {
        const id = uuidv4();
        const task: SimpleTask = {
            id,
            name: `AI_INTERACTION_${type}`,
            type,
            interval,
            lastRun: Date.now(),
            handler: handler || (() => Promise.resolve())
        };

        this.tasks.set(id, task);
        elizaLogger.debug(`[AlfaFrensTaskManager] Created ${type} task with interval ${interval}ms`);

        // Set up interval if running
        if (this.isRunning) {
            this.startTaskInterval(task);
        }

        return task;
    }

    /**
     * Start running task intervals
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            return;
        }

        this.isRunning = true;
        elizaLogger.debug("[AlfaFrensTaskManager] Starting task manager");

        // Start all task intervals
        for (const task of this.tasks.values()) {
            this.startTaskInterval(task);
        }
    }

    /**
     * Stop all task intervals
     */
    async stop(): Promise<void> {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;
        elizaLogger.debug("[AlfaFrensTaskManager] Stopping task manager");

        // Clear all intervals
        for (const [id, interval] of this.intervals.entries()) {
            clearInterval(interval);
            this.intervals.delete(id);
        }
    }

    /**
     * Process all tasks immediately
     */
    async processTasks(): Promise<void> {
        elizaLogger.debug(`[AlfaFrensTaskManager] Processing ${this.tasks.size} tasks`);

        for (const task of this.tasks.values()) {
            try {
                await task.handler();
                task.lastRun = Date.now();
            } catch (error) {
                elizaLogger.error(`[AlfaFrensTaskManager] Error processing task ${task.name}:`, error);
            }
        }
    }

    /**
     * Start interval for a task
     */
    private startTaskInterval(task: SimpleTask): void {
        // Clear existing interval if any
        if (this.intervals.has(task.id)) {
            clearInterval(this.intervals.get(task.id)!);
        }

        // Set new interval
        const interval = setInterval(async () => {
            try {
                await task.handler();
                task.lastRun = Date.now();
            } catch (error) {
                elizaLogger.error(`[AlfaFrensTaskManager] Error in task ${task.name}:`, error);
            }
        }, task.interval);

        this.intervals.set(task.id, interval);
        elizaLogger.debug(`[AlfaFrensTaskManager] Started interval for task ${task.name}`);
    }
} 