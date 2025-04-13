import { IPlugin } from '../interfaces/plugin';
import { Intent } from '../intent';

export class ReminderPlugin implements IPlugin {
    name = 'reminder';
    version = '1.0.0';
    description = 'Handles reminder-related intents';

    canHandle(intent: Intent): boolean {
        return intent.action === 'set_reminder';
    }

    async execute(intent: Intent): Promise<void> {
        const { title, time } = intent.parameters;
        console.log(`Setting reminder "${title}" for ${time}`);
        // TODO: Implement actual reminder functionality
    }
} 