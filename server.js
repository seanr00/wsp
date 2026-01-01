const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static('public'));

// File path for persistent storage
const DATA_FILE = path.join(__dirname, 'sessions-data.json');

// In-memory storage
const sessions = new Map(); // sessionID -> { clients: Set<socketId>, data: {}, ip }
const socketToSession = new Map(); // socketId -> sessionID (for clients)
const globalDashboards = new Set(); // all dashboard socket ids

// --- Persistence Functions ---
function loadSessionsFromFile() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const rawData = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(rawData);
      
      // Restore sessions (but not the active socket connections)
      Object.entries(parsed).forEach(([sessionID, sessionData]) => {
        sessions.set(sessionID, {
          clients: new Set(), // Will be repopulated when clients reconnect
          data: sessionData.data || {},
          ip: sessionData.ip || 'unknown'
        });
      });
      
      console.log(`Loaded ${sessions.size} sessions from ${DATA_FILE}`);
    } else {
      console.log('No existing session data file found. Starting fresh.');
    }
  } catch (error) {
    console.error('Error loading sessions from file:', error);
  }
}

function saveSessionsToFile() {
  try {
    // Convert Map to plain object, excluding the Set of active clients
    const dataToSave = {};
    sessions.forEach((session, sessionID) => {
      dataToSave[sessionID] = {
        data: session.data,
        ip: session.ip,
        lastUpdate: new Date().toISOString()
      };
    });
    
    fs.writeFileSync(DATA_FILE, JSON.stringify(dataToSave, null, 2), 'utf8');
    console.log(`Saved ${Object.keys(dataToSave).length} sessions to ${DATA_FILE}`);
  } catch (error) {
    console.error('Error saving sessions to file:', error);
  }
}

// Debounced save to avoid writing too frequently
let saveTimeout;
function debouncedSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveSessionsToFile();
  }, 1000); // Save 1 second after last change
}

// Load existing sessions on startup
loadSessionsFromFile();

// Save sessions on server shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  saveSessionsToFile();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down server...');
  saveSessionsToFile();
  process.exit(0);
});

// Serve dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Serve client
app.get('/client', (req, res) => {
  res.sendFile(path.join(__dirname, 'client.html'));
});

// API endpoint to get all sessions (for dashboard to load on startup)
app.get('/api/sessions', (req, res) => {
  const sessionList = Array.from(sessions.entries()).map(([id, s]) => ({
    sessionID: id,
    ip: s.ip || 'unknown',
    data: s.data,
    online: s.clients.size > 0
  }));
  res.json(sessionList);
});

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  // Dashboard joins (we register it globally so it sees all sessions)
  socket.on('dashboard-join', ({ sessionID }) => {
    // Keep a record that this socket is a dashboard (so it receives global events)
    globalDashboards.add(socket.id);
    // Optionally remember a "dashboard session id" (not used for filtering here)
    socketToSession.set(socket.id, `dashboard:${sessionID || socket.id}`);

    console.log(`Dashboard ${socket.id} joined (dashboardSessionID=${sessionID})`);

    // Send the full list of known sessions to this dashboard (including offline ones)
    const sessionList = Array.from(sessions.entries()).map(([id, s]) => ({
      sessionID: id,
      ip: s.ip || 'unknown',
      online: s.clients.size > 0
    }));
    socket.emit('session-list', sessionList);

    // Send all historical data for each session
    sessions.forEach((session, sessionID) => {
      if (Object.keys(session.data).length > 0) {
        const events = Object.entries(session.data).map(([type, data]) => ({
          type,
          data
        }));
        socket.emit('session-history', { sessionID, events });
      }
    });
  });

  // Client joins with a sessionID
  socket.on('client-join', ({ sessionID }) => {
    if (!sessionID) return;

    socketToSession.set(socket.id, sessionID);

    if (!sessions.has(sessionID)) {
      sessions.set(sessionID, {
        clients: new Set(),
        data: {},
        ip: socket.handshake.address
      });
      debouncedSave(); // Save when new session is created
    }

    const session = sessions.get(sessionID);
    session.clients.add(socket.id);
    session.ip = socket.handshake.address;

    console.log(`Client ${socket.id} joined session ${sessionID}`);

    // Notify ALL dashboards (global) about this client connection
    globalDashboards.forEach(dashId => {
      io.to(dashId).emit('client-connected', {
        sessionID,
        ip: session.ip
      });
    });
  });

  // Forward dashboard actions to clients in the same session
  socket.on('dashboard-action', ({ sessionID, buttonName, value }) => {
    const session = sessions.get(sessionID);
    if (!session) return;

    console.log(`Dashboard action: ${buttonName} for session ${sessionID}`);

    session.clients.forEach(clientId => {
      io.to(clientId).emit('dashboard-action', {
        buttonName,
        value: value || buttonName
      });
    });
  });

  // Forward client data updates to dashboards in the global set
  socket.on('client-data', ({ type, data }) => {
    const sessionID = socketToSession.get(socket.id);
    if (!sessionID) return;

    const session = sessions.get(sessionID);
    if (!session) return;

    session.data[type] = data;
    debouncedSave(); // Save after data change

    // Emit to all dashboards so they can update their UI
    globalDashboards.forEach(dashId => {
      io.to(dashId).emit(`client-${type}`, {
        sessionID,
        [type]: data
      });
    });
  });

  // Dashboard requests history → send only for requested session
  socket.on('request-session-history', (sessionID) => {
    const session = sessions.get(sessionID);
    if (!session) return;

    const events = [];
    for (const [type, data] of Object.entries(session.data)) {
      events.push({ type, data });
    }

    socket.emit('session-history', { sessionID, events });
  });

  // Dashboard deletes a session
  socket.on('dashboard-delete-session', ({ dashboardID, sessionID }) => {
    console.log(`Dashboard ${dashboardID} requested deletion of session ${sessionID}`);
    
    if (sessions.has(sessionID)) {
      sessions.delete(sessionID);
      debouncedSave(); // Save after deletion
      
      // Notify the requesting dashboard
      socket.emit('dashboard-delete-ack', { dashboardID, sessionID });
    }
  });

  // Disconnect cleanup
  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);

    // Remove from global dashboards if present
    if (globalDashboards.has(socket.id)) {
      globalDashboards.delete(socket.id);
    }

    const sessionID = socketToSession.get(socket.id);

    if (sessionID && sessions.has(sessionID)) {
      const session = sessions.get(sessionID);

      // Remove socket from clients set if it was a client
      session.clients.delete(socket.id);

      // Notify dashboards globally that a client disconnected
      globalDashboards.forEach(dashId => {
        io.to(dashId).emit('client-disconnected', { sessionID });
      });

      // Don't delete empty sessions anymore - keep them for historical data
      // if (session.clients.size === 0) {
      //   sessions.delete(sessionID);
      // }
    }

    socketToSession.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}/dashboard`);
  console.log(`Client: http://localhost:${PORT}/client`);
  console.log(`Sessions data file: ${DATA_FILE}`);
});