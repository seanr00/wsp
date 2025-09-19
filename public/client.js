const io = require('socket.io-client');

class WebSocketClient {
  constructor(serverUrl = 'http://localhost:3000') {
    this.serverUrl = serverUrl;
    this.socket = null;
    this.sessionId = null;
    this.isConnected = false;
    this.messageHandlers = new Map();
    this.sessionCookie = null;
  }

  // Cookie management (simulated for Node.js environment)
  setCookie(name, value) {
    this.sessionCookie = { name, value, timestamp: Date.now() };
    console.log(`[COOKIE] Set ${name} = ${value}`);
  }

  getCookie(name) {
    if (this.sessionCookie && this.sessionCookie.name === name) {
      return this.sessionCookie.value;
    }
    return null;
  }

  // Generate a new session ID
  generateSessionId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  // Connect to server with session ID
  connect(sessionId = null, metadata = {}) {
    return new Promise((resolve, reject) => {
      try {
        // Use provided session ID or get from cookie or generate new one
        if (!sessionId) {
          sessionId = this.getCookie('sessionId') || this.generateSessionId();
        }

        this.sessionId = sessionId;
        this.setCookie('sessionId', sessionId);

        console.log(`[CLIENT] Connecting to ${this.serverUrl} with session ID: ${sessionId}`);
        
        this.socket = io(this.serverUrl);

        this.socket.on('connect', () => {
          console.log('[CLIENT] Connected to server');
          
          // Join session with metadata
          this.socket.emit('client-join', {
            sessionId: this.sessionId,
            metadata: {
              clientType: 'node-client',
              timestamp: new Date().toISOString(),
              ...metadata
            }
          });

          this.isConnected = true;
          resolve(this.sessionId);
        });

        this.socket.on('disconnect', () => {
          console.log('[CLIENT] Disconnected from server');
          this.isConnected = false;
        });

        this.socket.on('dashboard-message', (data) => {
          console.log(`[CLIENT] Message from dashboard:`, data);
          this.handleDashboardMessage(data);
        });

        this.socket.on('error', (data) => {
          console.error('[CLIENT] Socket error:', data);
          reject(new Error(data.message));
        });

        this.socket.on('connect_error', (error) => {
          console.error('[CLIENT] Connection error:', error);
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  // Disconnect from server
  disconnect() {
    if (this.socket) {
      console.log('[CLIENT] Disconnecting...');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.sessionId = null;
    }
  }

  // Send message to dashboard
  sendToDashboard(messageType, message) {
    if (!this.isConnected || !this.socket) {
      console.error('[CLIENT] Not connected to server');
      return false;
    }

    console.log(`[CLIENT] Sending to dashboard: [${messageType}] ${message}`);
    
    this.socket.emit('client-to-dashboard', {
      messageType,
      message
    });

    return true;
  }

  // Handle incoming messages from dashboard
  handleDashboardMessage(data) {
    const { messageType, message, timestamp } = data;
    
    // Check if there's a specific handler for this message type
    if (this.messageHandlers.has(messageType)) {
      const handler = this.messageHandlers.get(messageType);
      try {
        handler(message, data);
      } catch (error) {
        console.error(`[CLIENT] Error in message handler for ${messageType}:`, error);
      }
    } else {
      // Default handling
      console.log(`[CLIENT] Received [${messageType}]: ${message}`);
    }

    // Handle built-in message types
    switch (messageType) {
      case 'ping':
        this.sendToDashboard('response', 'pong');
        break;
      case 'disconnect':
        console.log('[CLIENT] Disconnect requested by dashboard');
        setTimeout(() => this.disconnect(), 1000);
        break;
    }
  }

  // Register a custom message handler
  onMessage(messageType, handler) {
    this.messageHandlers.set(messageType, handler);
    console.log(`[CLIENT] Registered handler for message type: ${messageType}`);
  }

  // Remove a message handler
  removeMessageHandler(messageType) {
    this.messageHandlers.delete(messageType);
    console.log(`[CLIENT] Removed handler for message type: ${messageType}`);
  }

  // Update session metadata
  updateMetadata(metadata) {
    if (!this.isConnected || !this.socket) {
      console.error('[CLIENT] Not connected to server');
      return false;
    }

    this.socket.emit('update-session-metadata', metadata);
    return true;
  }

  // Send custom event
  sendCustomEvent(eventData) {
    if (!this.isConnected || !this.socket) {
      console.error('[CLIENT] Not connected to server');
      return false;
    }

    this.socket.emit('custom-event', eventData);
    return true;
  }

  // Get current session info
  getSessionInfo() {
    return {
      sessionId: this.sessionId,
      isConnected: this.isConnected,
      serverUrl: this.serverUrl
    };
  }
}

// Example usage
async function example() {
  const client = new WebSocketClient();

  // Register custom message handlers
  client.onMessage('notification', (message) => {
    console.log(`🔔 Notification: ${message}`);
  });

  client.onMessage('command', (message) => {
    console.log(`⚡ Command received: ${message}`);
    // Execute some command logic here
    client.sendToDashboard('response', `Command "${message}" executed successfully`);
  });

  client.onMessage('alert', (message) => {
    console.log(`🚨 Alert: ${message}`);
  });

  try {
    // Connect with a specific session ID or let it generate one
    const sessionId = await client.connect(null, {
      clientName: 'Example Client',
      version: '1.0.0'
    });
    
    console.log(`Connected with session ID: ${sessionId}`);

    // Send initial status
    client.sendToDashboard('status', 'Client connected and ready');

    // Send periodic heartbeat
    setInterval(() => {
      if (client.isConnected) {
        client.sendToDashboard('status', `Heartbeat at ${new Date().toISOString()}`);
      }
    }, 30000); // Every 30 seconds

    // Example of sending different types of messages
    setTimeout(() => {
      client.sendToDashboard('data', JSON.stringify({ 
        temperature: 23.5, 
        humidity: 65,
        timestamp: Date.now()
      }));
    }, 5000);

    setTimeout(() => {
      client.updateMetadata({
        lastActivity: new Date().toISOString(),
        status: 'processing'
      });
    }, 10000);

  } catch (error) {
    console.error('Failed to connect:', error);
  }

  // Handle process termination gracefully
  process.on('SIGINT', () => {
    console.log('[CLIENT] Shutting down...');
    client.disconnect();
    process.exit(0);
  });
}

// Export the class for use in other modules
module.exports = WebSocketClient;

// Run example if this file is executed directly
if (require.main === module) {
  example();
}