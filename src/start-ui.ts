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

  // Middleware configuration
  app.use(express.json({ limit: '10mb' }));
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

  // Simple test endpoint for debugging
  app.get('/api/test', (req, res) => {
    res.json({ success: true, message: 'API is working' });
  });

  // API endpoint for testing AI
  app.post('/api/test-ai', function (req, res) {
    (async () => {
      try {
        // Debug the incoming request in more detail
        console.log('Headers:', req.headers);
        console.log('Body type:', typeof req.body);
        console.log('Body:', JSON.stringify(req.body, null, 2));
        console.log('Is body empty?', Object.keys(req.body).length === 0);
        console.log('Content-Type:', req.get('Content-Type'));

        const { message, username = 'TestUser' } = req.body;

        console.log('Message:', message);
        console.log('Username:', username);

        if (!message) {
          console.log('Missing message in request body');
          return res.status(400).json({ success: false, error: 'Message is required' });
        }

        console.log(`Processing request from ${username}: "${message}"`);

        // Execute the directChat:message intent
        const intent = new Intent('directChat:message', { message, username });

        try {
          const startTime = Date.now();
          const result = await mcp.executeIntent(intent);
          const responseTime = Date.now() - startTime;

          // Transform the response to match client expectations
          if (result && result.data) {
            res.json({
              success: true,
              data: {
                response: result.data.response || result.data,
                metadata: {
                  responseTime: `${responseTime}ms`,
                  ...result.data.metadata
                }
              }
            });
          } else {
            res.json({
              success: true,
              data: {
                response: "I received your message, but couldn't generate a proper response.",
                metadata: {
                  responseTime: `${responseTime}ms`
                }
              }
            });
          }
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
            <button id="test-button" style="background-color: #ff8c00;">Test API</button>
          </div>
          <div class="status" id="status"></div>
        </div>
      
        <script>
          document.addEventListener('DOMContentLoaded', () => {
            const chatContainer = document.getElementById('chat-container');
            const messageInput = document.getElementById('message-input');
            const sendButton = document.getElementById('send-button');
            const testButton = document.getElementById('test-button');
            const status = document.getElementById('status');
            
            sendButton.addEventListener('click', sendMessage);
            testButton.addEventListener('click', testApi);
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
                console.log('Sending request with content:', content);
                
                // Try a different method to send the request
                const formData = new URLSearchParams();
                formData.append('message', content);
                
                // Log what we're about to send
                console.log('Sending URL-encoded form data:', formData.toString());
                
                // First try with URL-encoded form data
                const response = await fetch('/api/test-ai', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                  body: formData
                });
                
                // Check if response is OK before parsing JSON
                if (!response.ok) {
                  const errorText = await response.text();
                  console.error('Server error response:', errorText);
                  throw new Error("Server returned " + response.status + ": " + response.statusText);
                }
                
                const result = await response.json();
                console.log('Received response:', result);
                hideStatus();
                
                if (result.success) {
                  // Handle both direct response and nested response formats
                  const responseText = result.data && result.data.response 
                    ? result.data.response
                    : (typeof result.data === 'string' ? result.data : JSON.stringify(result.data));
                  
                  const metadata = result.data && result.data.metadata ? result.data.metadata : null;
                  addMessage(responseText, 'bot', metadata);
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
            
            // Simple test function
            async function testApi() {
              showStatus('Testing API...');
              try {
                const response = await fetch('/api/test');
                const data = await response.json();
                showStatus('API test result: ' + JSON.stringify(data), false);
              } catch (error) {
                showStatus('API test failed: ' + error.message, true);
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