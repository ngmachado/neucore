import { IPlugin } from '../interfaces/plugin';
import { Intent } from '../intent';

export class EmailPlugin implements IPlugin {
    name = 'email';
    version = '1.0.0';
    description = 'Handles email-related intents';

    canHandle(intent: Intent): boolean {
        return intent.action === 'send_email';
    }

    async execute(intent: Intent): Promise<void> {
        const { to, subject, body } = intent.parameters;
        console.log(`Sending email to ${to} with subject "${subject}"`);
        // TODO: Implement actual email sending
    }
} 