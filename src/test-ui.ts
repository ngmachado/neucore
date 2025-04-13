import { initializeSystem } from './app';
import express from 'express';
import bodyParser from 'body-parser';
import { Intent } from './mcp/intent';

async function startTestUI() {
    // Initialize the system
    console.log('Initializing system...');
    const { mcp } = await initializeSystem();
    console.log('System initialized');

    // Create Express app
    const app = express();
    const port = 3030;

    // Middleware
    app.use(bodyParser.json());

    // API endpoint for testing AI
    app.post('/api/test-ai', function (req, res) {
        (async () => {
            try {
                const { message, username = 'TestUser' } = req.body;

                if (!message) {
                    return res.status(400).json({ success: false, error: 'Message is required' });
                }

                console.log(`Processing request from ${username}: "${message}"`);

                // Execute the testAI intent
                const intent = new Intent('alfafrens:testAI', { message, username });

                try {
                    const result = await mcp.executeIntent(intent);
                    res.json(result);
                } catch (error) {
                    console.error('Error processing request:', error);
                    res.status(500).json({
                        success: false,
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            } catch (error) {
                console.error('Error handling request:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        })();
    });

    // HTML UI
    app.get('/', function (req, res) {
        res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Neurocore AI Test</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            max-width: 800px; 
            margin: 0 auto; 
            padding: 20px; 
          }
          .container { 
            display: flex; 
            flex-direction: column; 
            height: 80vh; 
          }
          .chat-container { 
            flex: 1; 
            border: 1px solid #ccc; 
            border-radius: 8px; 
            padding: 20px; 
            overflow-y: auto; 
            margin-bottom: 20px; 
            background-color: #f9f9f9; 
          }
          .input-container { 
            display: flex; 
            gap: 10px; 
          }
          #message-input { 
            flex: 1; 
            padding: 12px; 
            border: 1px solid #ccc; 
            border-radius: 4px; 
          }
          button { 
            padding: 12px 24px; 
            background-color: #4285f4; 
            color: white; 
            border: none; 
            border-radius: 4px; 
            cursor: pointer; 
          }
          .message { 
            margin-bottom: 16px; 
            padding: 12px 16px; 
            border-radius: 8px; 
            max-width: 80%; 
            word-wrap: break-word; 
          }
          .user-message { 
            background-color: #e3f2fd; 
            margin-left: auto; 
          }
          .bot-message { 
            background-color: #e9e9e9; 
            margin-right: auto; 
          }
          .message-header { 
            font-weight: bold; 
            margin-bottom: 6px; 
            font-size: 0.9em; 
            color: #555; 
          }
          .status { 
            padding: 10px; 
            background-color: #f1f8e9; 
            border-radius: 4px; 
            margin-top: 10px; 
            display: none; 
          }
          h1 { 
            color: #4285f4; 
            text-align: center; 
          }
          .metadata { 
            font-size: 0.8em; 
            color: #777; 
            margin-top: 8px; 
            border-top: 1px solid #eee; 
            padding-top: 6px; 
          }
        </style>
      </head>
      <body>
        <h1>Neurocore AI Test UI</h1>
        <div class="container">
          <div class="chat-container" id="chat-container">
            <div class="message bot-message">
              <div class="message-header">AI Assistant</div>
              Hello! I'm your AI assistant. Ask me anything.
            </div>
          </div>
          <div class="input-container">
            <input type="text" id="message-input" placeholder="Type your message here..." />
            <button id="send-button">Send</button>
          </div>
          <div class="status" id="status"></div>
        </div>
      
        <script>
          document.addEventListener('DOMContentLoaded', () => {
            const chatContainer = document.getElementById('chat-container');
            const messageInput = document.getElementById('message-input');
            const sendButton = document.getElementById('send-button');
            const status = document.getElementById('status');
            
            sendButton.addEventListener('click', sendMessage);
            messageInput.addEventListener('keyup', (e) => {
              if (e.key === 'Enter') sendMessage();
            });
            
            async function sendMessage() {
              const content = messageInput.value.trim();
              if (!content) return;
              
              addMessage(content, 'user');
              messageInput.value = '';
              
              showStatus('AI is thinking...');
              
              try {
                const response = await fetch('/api/test-ai', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ message: content })
                });
                
                const result = await response.json();
                hideStatus();
                
                if (result.success) {
                  addMessage(result.data.response, 'bot', result.data.metadata);
                } else {
                  showStatus('Error: ' + (result.error || 'Failed to get response'), true);
                  addMessage('Sorry, I encountered an error processing your request.', 'bot');
                }
              } catch (error) {
                hideStatus();
                showStatus('Error: ' + error.message, true);
                addMessage('Sorry, I encountered an error.', 'bot');
              }
            }
            
            function addMessage(content, sender, metadata = null) {
              const messageElement = document.createElement('div');
              messageElement.classList.add('message');
              messageElement.classList.add(sender === 'user' ? 'user-message' : 'bot-message');
              
              const header = document.createElement('div');
              header.classList.add('message-header');
              header.textContent = sender === 'user' ? 'You' : 'AI Assistant';
              
              const messageContent = document.createElement('div');
              messageContent.textContent = content;
              
              messageElement.appendChild(header);
              messageElement.appendChild(messageContent);
              
              if (metadata && metadata.responseTime) {
                const metadataElement = document.createElement('div');
                metadataElement.classList.add('metadata');
                metadataElement.textContent = "Response time: " + metadata.responseTime;
                messageElement.appendChild(metadataElement);
              }
              
              chatContainer.appendChild(messageElement);
              chatContainer.scrollTop = chatContainer.scrollHeight;
            }
            
            function showStatus(message, isError = false) {
              status.textContent = message;
              status.style.display = 'block';
              status.style.backgroundColor = isError ? '#ffebee' : '#f1f8e9';
            }
            
            function hideStatus() {
              status.style.display = 'none';
            }
          });
        </script>
      </body>
      </html>
    `);
    });

    // Start the server
    app.listen(port, () => {
        console.log(`
    =======================================================
    🚀 Neurocore AI Test UI is running!
    
    Open your browser and navigate to: http://localhost:${port}
    
    Test the AI by typing messages in the chat interface.
    =======================================================
    `);
    });

    // Handle shutdown
    process.on('SIGINT', async () => {
        console.log('Shutting down...');
        await mcp.shutdown();
        process.exit(0);
    });
}

// Start if this file is run directly
if (require.main === module) {
    startTestUI().catch(error => {
        console.error('Failed to start test UI:', error);
        process.exit(1);
    });
}

export { startTestUI };