import { IPlugin } from '../interfaces/plugin';
import { Intent } from '../intent';

export class CalendarPlugin implements IPlugin {
    name = 'calendar';
    version = '1.0.0';
    description = 'Handles calendar-related intents';

    canHandle(intent: Intent): boolean {
        return intent.action === 'schedule_event';
    }

    async execute(intent: Intent): Promise<void> {
        const { title, startTime, endTime } = intent.parameters;
        console.log(`Scheduling event: ${title} from ${startTime} to ${endTime}`);
        // TODO: Implement actual calendar integration
    }
} 