import { IPlugin } from '../interfaces/plugin';
import { Intent } from '../intent';

export class WeatherPlugin implements IPlugin {
    name = 'weather';
    version = '1.0.0';
    description = 'Handles weather-related intents';

    canHandle(intent: Intent): boolean {
        return intent.action === 'get_weather';
    }

    async execute(intent: Intent): Promise<void> {
        const { location } = intent.parameters;
        console.log(`Getting weather for ${location}`);
        // TODO: Implement actual weather API call
    }
} 