# WebSocket Authentication

JWT-based authentication system for Socket.IO WebSocket connections with comprehensive middleware support.

## Features

- ✅ JWT token verification via query params, headers, or auth object
- ✅ User authentication and authorization
- ✅ Role-based access control (RBAC)
- ✅ Token refresh support
- ✅ Namespace and room-level protection
- ✅ Event-level authorization
- ✅ Rate limiting
- ✅ Email verification requirements
- ✅ Comprehensive error handling

## Quick Start

### Basic Server Setup

```typescript
import { Server } from 'socket.io';
import { socketAuthMiddleware } from './websocket/middleware/authMiddleware';

const io = new Server(3000);

// Require authentication for all connections
io.use(socketAuthMiddleware);

io.on('connection', (socket) => {
  console.log('Authenticated user connected:', socket.data.user);

  socket.on('message', (data) => {
    // User is guaranteed to be authenticated here
    console.log(`Message from ${socket.data.user.username}:`, data);
  });
});
```

### Client Connection

```typescript
import { io } from 'socket.io-client';

// Option 1: Query parameter
const socket = io('http://localhost:3000', {
  query: { token: 'your-jwt-token' }
});

// Option 2: Authorization header
const socket = io('http://localhost:3000', {
  extraHeaders: {
    Authorization: 'Bearer your-jwt-token'
  }
});

// Option 3: Auth object
const socket = io('http://localhost:3000', {
  auth: { token: 'your-jwt-token' }
});

// Handle connection errors
socket.on('connect_error', (error) => {
  console.error('Connection failed:', error.message);
});

socket.on('connect', () => {
  console.log('Connected successfully');
});
```

## Authentication Middleware

### Required Authentication

```typescript
import { socketAuthMiddleware } from './websocket/middleware/authMiddleware';

// All connections must be authenticated
io.use(socketAuthMiddleware);
```

### Optional Authentication

```typescript
import { optionalAuthMiddleware } from './websocket/middleware/authMiddleware';

// Allow both authenticated and unauthenticated connections
io.use(optionalAuthMiddleware);

io.on('connection', (socket) => {
  if (socket.data.authenticated) {
    console.log('Authenticated user:', socket.data.user.username);
  } else {
    console.log('Anonymous user connected');
  }
});
```

### Namespace-Specific Authentication

```typescript
import { namespaceAuthMiddleware } from './websocket/middleware/authMiddleware';

// Public namespace - no auth required
const publicNamespace = io.of('/public');

// Private namespace - auth required
const privateNamespace = io.of('/private');
privateNamespace.use(namespaceAuthMiddleware({ requireAuth: true }));

// VIP namespace - auth + verification + roles required
const vipNamespace = io.of('/vip');
vipNamespace.use(namespaceAuthMiddleware({
  requireAuth: true,
  requireVerified: true,
  requiredRoles: ['vip', 'premium']
}));
```

## Role-Based Access Control

### Define User Roles

```typescript
// In your authentication system
const user = {
  userId: '123',
  username: 'john',
  email: 'john@example.com',
  isVerified: true,
  roles: ['user', 'premium', 'moderator'] // Define roles here
};
```

### Protect Namespaces with Roles

```typescript
import { requireRoleMiddleware, requireAnyRoleMiddleware } from './websocket/middleware/authMiddleware';

// Admin-only namespace
const adminNamespace = io.of('/admin');
adminNamespace.use(requireRoleMiddleware('admin'));

// Moderator or admin namespace
const modNamespace = io.of('/moderation');
modNamespace.use(requireAnyRoleMiddleware(['moderator', 'admin']));
```

### Protect Events with Roles

```typescript
import { eventAuthMiddleware } from './websocket/middleware/authMiddleware';

io.on('connection', (socket) => {
  // Admin-only event
  socket.on('admin:deleteUser',
    eventAuthMiddleware(['admin'], async (socket, data) => {
      // Only admins can execute this
      await deleteUser(data.userId);
    })
  );

  // Moderator or admin event
  socket.on('mod:banUser',
    eventAuthMiddleware(['moderator', 'admin'], async (socket, data) => {
      // Moderators and admins can execute this
      await banUser(data.userId);
    })
  );
});
```

## Room Protection

### Protect Specific Rooms

```typescript
import { roomAuthMiddleware } from './websocket/middleware/authMiddleware';

io.on('connection', (socket) => {
  // Public room - anyone can join
  socket.on('join:public', () => {
    socket.join('public-room');
  });

  // Premium room - requires premium role
  socket.on('join:premium',
    roomAuthMiddleware('premium-room', {
      requireAuth: true,
      requiredRoles: ['premium', 'vip']
    })
  );

  // VIP room - requires VIP role and email verification
  socket.on('join:vip',
    roomAuthMiddleware('vip-room', {
      requireAuth: true,
      requireVerified: true,
      requiredRoles: ['vip']
    })
  );

  // Custom authorization check
  socket.on('join:special',
    roomAuthMiddleware('special-room', {
      customCheck: async (socket) => {
        const user = getSocketUser(socket);
        // Custom logic here
        return user?.username.startsWith('special_');
      }
    })
  );
});
```

## Token Refresh

### Server-Side Setup

```typescript
import { refreshSocketToken } from './websocket/auth';

io.on('connection', (socket) => {
  socket.on('token:refresh', async (newToken) => {
    try {
      await refreshSocketToken(socket, newToken);
      // Token refreshed successfully
    } catch (error) {
      console.error('Token refresh failed:', error);
    }
  });
});
```

### Client-Side Usage

```typescript
socket.on('token:refreshed', (response) => {
  console.log('Token refreshed successfully');
});

socket.on('token:refresh:error', (response) => {
  console.error('Token refresh failed:', response.message);
});

// Refresh token before it expires
socket.emit('token:refresh', newJwtToken);
```

## Rate Limiting

```typescript
import { rateLimitMiddleware } from './websocket/middleware/authMiddleware';

// Limit to 10 events per second per user
io.use(rateLimitMiddleware(10, 1000));

// Or apply to specific namespace
const chatNamespace = io.of('/chat');
chatNamespace.use(rateLimitMiddleware(5, 1000)); // 5 messages per second
```

## Email Verification Requirement

```typescript
import { requireVerifiedMiddleware } from './websocket/middleware/authMiddleware';

// Require verified email for all connections
io.use(socketAuthMiddleware);
io.use(requireVerifiedMiddleware);

// Or for specific namespace
const verifiedNamespace = io.of('/verified');
verifiedNamespace.use(socketAuthMiddleware);
verifiedNamespace.use(requireVerifiedMiddleware);
```

## Accessing User Information

```typescript
import { getSocketUser, isSocketAuthenticated } from './websocket/auth';

io.on('connection', (socket) => {
  // Check if authenticated
  if (isSocketAuthenticated(socket)) {
    const user = getSocketUser(socket);
    console.log('User info:', {
      userId: user.userId,
      username: user.username,
      email: user.email,
      isVerified: user.isVerified,
      roles: user.roles
    });
  }

  socket.on('message', (data) => {
    // Access user in event handler
    const user = socket.data.user;
    console.log(`Message from ${user.username}:`, data);
  });
});
```

## Error Handling

### Connection Errors

```typescript
// Client-side
socket.on('connect_error', (error) => {
  console.error('Connection failed:', error.message);

  if (error.data?.code === 'AUTH_FAILED') {
    // Handle authentication failure
    redirectToLogin();
  }

  if (error.data?.code === 'VERIFICATION_REQUIRED') {
    // Handle verification requirement
    showVerificationPrompt();
  }
});
```

### Event Errors

```typescript
// Server-side
socket.on('someEvent', async (data, callback) => {
  try {
    const result = await processEvent(data);
    callback({ success: true, data: result });
  } catch (error) {
    callback({
      success: false,
      error: error.message
    });
  }
});

// Client-side
socket.emit('someEvent', data, (response) => {
  if (response.success) {
    console.log('Success:', response.data);
  } else {
    console.error('Error:', response.error);
  }
});
```

## Complete Example

### Server

```typescript
import { Server } from 'socket.io';
import express from 'express';
import { createServer } from 'http';
import {
  socketAuthMiddleware,
  namespaceAuthMiddleware,
  roomAuthMiddleware,
  eventAuthMiddleware
} from './websocket/middleware/authMiddleware';
import { getSocketUser } from './websocket/auth';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL,
    credentials: true
  }
});

// Main namespace - require authentication
io.use(socketAuthMiddleware);

io.on('connection', (socket) => {
  const user = getSocketUser(socket);
  console.log(`User connected: ${user.username}`);

  // Join user's private room
  socket.join(`user:${user.userId}`);

  // Public event
  socket.on('message', (data) => {
    io.emit('message', {
      user: user.username,
      message: data.message,
      timestamp: new Date()
    });
  });

  // Protected room join
  socket.on('join:private',
    roomAuthMiddleware('private-chat', {
      requireVerified: true
    })
  );

  // Admin event
  socket.on('admin:broadcast',
    eventAuthMiddleware(['admin'], (socket, data) => {
      io.emit('announcement', data);
    })
  );

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${user.username}`);
  });
});

// Admin namespace
const adminNamespace = io.of('/admin');
adminNamespace.use(namespaceAuthMiddleware({
  requireAuth: true,
  requiredRoles: ['admin']
}));

httpServer.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### Client

```typescript
import { io } from 'socket.io-client';

const token = localStorage.getItem('jwt_token');

const socket = io('http://localhost:3000', {
  query: { token },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5
});

socket.on('connect', () => {
  console.log('Connected to server');

  // Join a room
  socket.emit('join:private', (error) => {
    if (error) {
      console.error('Failed to join room:', error.message);
    } else {
      console.log('Joined private room');
    }
  });
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message);
  if (error.data?.code === 'AUTH_FAILED') {
    window.location.href = '/login';
  }
});

socket.on('message', (data) => {
  console.log(`${data.user}: ${data.message}`);
});

// Send a message
socket.emit('message', { message: 'Hello, world!' });

// Admin broadcast (will fail if not admin)
socket.emit('admin:broadcast',
  { message: 'Server maintenance in 5 minutes' },
  (response) => {
    if (response.success) {
      console.log('Broadcast sent');
    } else {
      console.error('Broadcast failed:', response.error);
    }
  }
);
```

## Testing

Run the test suite:

```bash
npm test src/__tests__/websocket/auth.test.ts
```

## Security Best Practices

1. **Always use HTTPS/WSS in production**
2. **Set short token expiration times** (e.g., 24 hours)
3. **Implement token refresh mechanism**
4. **Validate all user input**
5. **Use rate limiting to prevent abuse**
6. **Log authentication failures**
7. **Implement IP-based blocking for repeated failures**
8. **Never expose sensitive user data in socket events**
9. **Use namespaces to isolate different access levels**
10. **Regularly rotate JWT secrets**

## Troubleshooting

### Connection keeps failing

- Verify JWT token is valid and not expired
- Check that PlayerService.validateToken() is working
- Ensure database connection is active
- Check CORS configuration

### Token not being extracted

- Verify token format (Bearer prefix for Authorization header)
- Check client is sending token in correct location
- Verify no encoding issues with token string

### Role-based access not working

- Ensure roles are properly set in user object
- Verify role names match exactly (case-sensitive)
- Check that attachUserToSocket() was called

## API Reference

See inline documentation in:
- `/src/websocket/auth.ts` - Core authentication functions
- `/src/websocket/middleware/authMiddleware.ts` - Middleware implementations
