/**
 * Advanced WebSocket Authentication Example
 *
 * This example demonstrates:
 * - Multiple namespaces with different auth requirements
 * - Room-based access control
 * - Role-based event handlers
 * - Token refresh
 */

import { Server } from 'socket.io';
import { createServer } from 'http';
import express from 'express';
import {
  socketAuthMiddleware,
  optionalAuthMiddleware,
  namespaceAuthMiddleware,
  roomAuthMiddleware,
  eventAuthMiddleware,
  rateLimitMiddleware
} from '../middleware/authMiddleware';
import { getSocketUser, refreshSocketToken } from '../auth';

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

// === PUBLIC NAMESPACE - No auth required ===
const publicNamespace = io.of('/public');
publicNamespace.use(optionalAuthMiddleware);

publicNamespace.on('connection', (socket) => {
  const user = getSocketUser(socket);

  if (user) {
    console.log(`✅ Authenticated user joined public: ${user.username}`);
  } else {
    console.log('👤 Anonymous user joined public');
  }

  socket.on('public:message', (data) => {
    publicNamespace.emit('public:message', {
      from: user?.username || 'Anonymous',
      message: data.message,
      timestamp: new Date().toISOString()
    });
  });
});

// === MAIN NAMESPACE - Auth required ===
io.use(socketAuthMiddleware);
io.use(rateLimitMiddleware(10, 1000)); // 10 events per second

io.on('connection', (socket) => {
  const user = getSocketUser(socket);

  if (!user) {
    socket.disconnect();
    return;
  }

  console.log(`✅ User connected: ${user.username}`);

  // Join user's personal room
  socket.join(`user:${user.userId}`);

  // Public chat room - anyone can join
  socket.on('join:chat', () => {
    socket.join('chat');
    socket.emit('room:joined', { room: 'chat' });
    console.log(`${user.username} joined chat`);
  });

  // Premium room - requires premium role
  socket.on('join:premium',
    roomAuthMiddleware('premium-lounge', {
      requireAuth: true,
      requireVerified: true,
      requiredRoles: ['premium', 'vip']
    })
  );

  // VIP room - requires VIP role
  socket.on('join:vip',
    roomAuthMiddleware('vip-lounge', {
      requireAuth: true,
      requireVerified: true,
      requiredRoles: ['vip']
    })
  );

  // Send message to room
  socket.on('room:message', (data) => {
    const { room, message } = data;

    // Check if user is in the room
    if (!socket.rooms.has(room)) {
      socket.emit('error', { message: 'You are not in this room' });
      return;
    }

    io.to(room).emit('room:message', {
      room,
      from: user.username,
      userId: user.userId,
      message,
      timestamp: new Date().toISOString()
    });
  });

  // Token refresh
  socket.on('token:refresh', async (newToken: string) => {
    try {
      await refreshSocketToken(socket as any, newToken);
      console.log(`✅ Token refreshed for ${user.username}`);
    } catch (error) {
      console.error(`❌ Token refresh failed for ${user.username}:`, error);
    }
  });

  socket.on('disconnect', () => {
    console.log(`❌ User disconnected: ${user.username}`);
  });
});

// === ADMIN NAMESPACE - Admin role required ===
const adminNamespace = io.of('/admin');
adminNamespace.use(namespaceAuthMiddleware({
  requireAuth: true,
  requireVerified: true,
  requiredRoles: ['admin']
}));

adminNamespace.on('connection', (socket) => {
  const user = getSocketUser(socket);

  if (!user) {
    socket.disconnect();
    return;
  }

  console.log(`👑 Admin connected: ${user.username}`);

  // Admin broadcast - only admins can use
  socket.on('admin:broadcast',
    eventAuthMiddleware(['admin'], async (socket, data) => {
      const user = getSocketUser(socket);
      console.log(`📢 Admin broadcast from ${user?.username}:`, data.message);

      // Broadcast to all connected clients on main namespace
      io.emit('announcement', {
        from: 'Admin',
        message: data.message,
        timestamp: new Date().toISOString()
      });
    })
  );

  // Admin stats
  socket.on('admin:stats', async () => {
    const stats = {
      totalConnections: io.sockets.sockets.size,
      publicConnections: publicNamespace.sockets.size,
      adminConnections: adminNamespace.sockets.size,
      rooms: Array.from(io.sockets.adapter.rooms.keys())
    };

    socket.emit('admin:stats', stats);
  });

  // Kick user (admin only)
  socket.on('admin:kick',
    eventAuthMiddleware(['admin'], async (socket, data: { userId: string; reason?: string }) => {
      const user = getSocketUser(socket);
      console.log(`Admin ${user?.username} kicking user ${data.userId}`);

      // Find and disconnect the user's socket
      const sockets = await io.fetchSockets();
      for (const s of sockets) {
        const targetUser = getSocketUser(s as any);
        if (targetUser?.userId === data.userId) {
          s.emit('kicked', {
            reason: data.reason || 'You have been kicked by an admin'
          });
          s.disconnect(true);
        }
      }
    })
  );
});

// === MODERATOR NAMESPACE - Moderator or admin role required ===
const modNamespace = io.of('/moderation');
modNamespace.use(namespaceAuthMiddleware({
  requireAuth: true,
  requireVerified: true,
  requiredRoles: ['moderator', 'admin']
}));

modNamespace.on('connection', (socket) => {
  const user = getSocketUser(socket);

  if (!user) {
    socket.disconnect();
    return;
  }

  console.log(`🛡️  Moderator connected: ${user.username}`);

  // Mute user
  socket.on('mod:mute',
    eventAuthMiddleware(['moderator', 'admin'], async (socket, data: { userId: string; duration: number }) => {
      const user = getSocketUser(socket);
      console.log(`Moderator ${user?.username} muted user ${data.userId} for ${data.duration}ms`);

      // Emit mute event to target user
      io.to(`user:${data.userId}`).emit('muted', {
        duration: data.duration,
        moderator: user?.username
      });

      // Store mute in database here
    })
  );

  // Ban user from room
  socket.on('mod:ban',
    eventAuthMiddleware(['moderator', 'admin'], async (socket, data: { userId: string; room: string }) => {
      const user = getSocketUser(socket);
      console.log(`Moderator ${user?.username} banned user ${data.userId} from ${data.room}`);

      // Remove user from room
      const sockets = await io.fetchSockets();
      for (const s of sockets) {
        const targetUser = getSocketUser(s as any);
        if (targetUser?.userId === data.userId) {
          s.leave(data.room);
          s.emit('banned', {
            room: data.room,
            moderator: user?.username
          });
        }
      }
    })
  );
});

// Start server
const PORT = process.env.WS_PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 WebSocket server running on port ${PORT}`);
  console.log(`📡 Namespaces: /public, /, /admin, /moderation`);
});

export { io, httpServer, publicNamespace, adminNamespace, modNamespace };
