import { ITemplateDataProvider } from '../../core/templates/dataProvider';

/**
 * Data provider for message-related template variables
 */
export class MessageDataProvider implements ITemplateDataProvider {
    /**
     * Get the namespace for this provider
     */
    public getNamespace(): string {
        return 'message';
    }

    /**
     * Get priority for this provider
     */
    public getPriority(): number {
        return 100; // High priority for message data
    }

    /**
     * Extract message-related variables from context
     */
    public getVariables(context: any): Record<string, any> {
        // Safety check
        if (!context) {
            return {};
        }

        // Extract message data from context
        const message = context.message || {};
        const sender = context.sender || {};

        // Format dates if available
        let formattedTime = '';
        let formattedDate = '';

        if (message.timestamp) {
            try {
                const timestamp = new Date(message.timestamp);
                formattedTime = timestamp.toLocaleTimeString();
                formattedDate = timestamp.toLocaleDateString();
            } catch (e) {
                // Invalid date, use raw value
                formattedTime = message.timestamp;
                formattedDate = message.timestamp;
            }
        }

        // Return formatted variables
        return {
            id: message.id || '',
            content: message.content || '',
            raw: message.content || '',
            timestamp: message.timestamp || '',
            time: formattedTime,
            date: formattedDate,
            username: sender.username || message.senderUsername || '',
            userId: sender.id || message.senderId || '',
            isReply: !!message.replyTo,
            replyTo: message.replyTo || '',
        };
    }
} 