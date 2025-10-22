/**
 * Basic WebSocket Authentication Example
 *
 * This example shows how to set up a basic authenticated WebSocket server
 */

import { Server } from 'socket.io';
import { createServer } from 'http';
import express from 'express';
import { socketAuthMiddleware } from '../middleware/authMiddleware';
import { getSocketUser } from '../auth';

// Create Express app
const app = express();
const httpServer = createServer(app);

// Create Socket.IO server
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
  }
});

// Apply authentication middleware
io.use(socketAuthMiddleware);

// Handle connections
io.on('connection', (socket) => {
  const user = getSocketUser(socket);

  if (!user) {
    console.error('No user data on authenticated socket');
    socket.disconnect();
    return;
  }

  console.log(`✅ User connected: ${user.username} (${user.userId})`);

  // Join user to their personal room
  socket.join(`user:${user.userId}`);

  // Handle events
  socket.on('message', (data) => {
    console.log(`Message from ${user.username}:`, data);

    // Broadcast to all clients
    io.emit('message', {
      userId: user.userId,
      username: user.username,
      message: data.message,
      timestamp: new Date().toISOString()
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`❌ User disconnected: ${user.username}`);
  });
});

// Start server
const PORT = process.env.WS_PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 WebSocket server running on port ${PORT}`);
});

export { io, httpServer };
