import { initializeSystem } from './app';
import express from 'express';
import { Request, Response } from 'express';
import bodyParser from 'body-parser';
import { Intent } from './mcp/intent';

async function startTestServer() {
  // Initialize the system
  console.log('Initializing Neurocore system...');
  const { mcp } = await initializeSystem();
  console.log('System initialized successfully');

  // Create Express app
  const app = express();
  const port = 3030;

  // Configure middleware
  app.use(bodyParser.json());

  // API endpoint for testing AI
  app.post('/api/test-ai', function (req: Request, res: Response) {
    (async () => {
      try {
        const { message, username = 'TestUser' } = req.body;

        if (!message) {
          return res.status(400).json({
            success: false,
            error: 'Message is required'
          });
        }

        console.log(`Processing request: "${message}" from ${username}`);

        // Create and execute intent
        const startTime = Date.now();
        const intent = new Intent('alfafrens:testAI', { message, username });
        const result = await mcp.executeIntent(intent);
        const responseTime = Date.now() - startTime;

        if (!result.success) {
          console.error('Error in test-ai endpoint:', result.error);
          return res.status(500).json({
            success: false,
            error: result.error || 'Failed to process request'
          });
        }

        console.log(`Response generated in ${responseTime}ms, length: ${result.data?.response?.length || 0} chars`);

        return res.json({
          success: true,
          data: {
            response: result.data?.response || "I couldn't generate a response at this time.",
            metadata: {
              responseTime: `${responseTime}ms`,
              ...result.data?.metadata
            }
          }
        });
      } catch (error) {
        console.error('Error processing request:', error);
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    })();
  });

  // Simple UI
  app.get('/', (_req: Request, res: Response) => {
    res.send(getChatInterfaceHtml());
  });

  // Start server
  app.listen(port, () => {
    console.log(`
=========================================================
🚀 Neurocore Test Server running at http://localhost:${port}
=========================================================
Visit this URL in your browser to test the AI assistant
    `);
  });

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Shutting down Neurocore system...');
    await mcp.shutdown();
    process.exit(0);
  });
}

function getChatInterfaceHtml() {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Neurocore Test UI</title>
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; 
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
          border: 1px solid #ddd; 
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
          border: 1px solid #ddd; 
          border-radius: 6px; 
          font-size: 16px;
        }
        button { 
          padding: 12px 24px; 
          background-color: #4285f4; 
          color: white; 
          border: none; 
          border-radius: 6px; 
          cursor: pointer; 
          font-size: 16px;
          transition: background-color 0.2s;
        }
        button:hover {
          background-color: #3367d6;
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
          line-height: 1.5;
        }
        .bot-message p {
          margin: 8px 0;
        }
        .bot-message ul, .bot-message ol {
          margin: 8px 0;
          padding-left: 20px;
        }
        .bot-message li {
          margin-bottom: 4px;
        }
        .bot-message br {
          display: block;
          content: "";
          margin-top: 8px;
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
          messageInput.addEventListener('keyup', (event) => {
            if (event.key === 'Enter') {
              sendMessage();
            }
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
                headers: {
                  'Content-Type': 'application/json'
                },
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
            if (sender === 'bot') {
              let formattedContent = content;
              formattedContent = formattedContent.replace(new RegExp(String.fromCharCode(10) + String.fromCharCode(10), 'g'), '<br><br>');
              formattedContent = formattedContent.replace(new RegExp(String.fromCharCode(10), 'g'), '<br>');
              messageContent.innerHTML = formattedContent;
            } else {
              messageContent.textContent = content;
            }
            
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
  `;
}

// Start if this file is run directly
if (require.main === module) {
  startTestServer().catch(error => {
    console.error('Failed to start test server:', error);
    process.exit(1);
  });
}

export { startTestServer }; 