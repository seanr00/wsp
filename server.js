const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static('public'));

// In-memory storage
const sessions = new Map(); // sessionID -> { clients: Set<socketId>, data: {}, ip }
const socketToSession = new Map(); // socketId -> sessionID (for clients)
const globalDashboards = new Set(); // all dashboard socket ids

// Serve dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Serve client
app.get('/client', (req, res) => {
  res.sendFile(path.join(__dirname, 'client.html'));
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

    // Send the full list of known sessions to this dashboard
    const sessionList = Array.from(sessions.entries()).map(([id, s]) => ({
      sessionID: id,
      ip: s.ip || 'unknown'
    }));
    socket.emit('session-list', sessionList);
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

      // Clean up empty sessions
      if (session.clients.size === 0) {
        sessions.delete(sessionID);
      }
    }

    socketToSession.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}/dashboard`);
  console.log(`Client: http://localhost:${PORT}/client`);
});
