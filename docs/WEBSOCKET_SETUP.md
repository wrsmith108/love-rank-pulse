# WebSocket Server Documentation

## Overview

The WebSocket server is built with Socket.io and provides real-time communication for:
- Leaderboard updates
- Match events
- Player notifications
- Live ranking changes

## Architecture

### Components

1. **WebSocket Server** (`src/websocket/server.ts`)
   - Main Socket.io server initialization
   - Namespace configuration
   - Connection handling
   - Health checks

2. **Connection Manager** (`src/websocket/connectionManager.ts`)
   - Client connection lifecycle
   - Room management
   - Broadcasting utilities
   - Metrics tracking

3. **Type Definitions** (`src/websocket/types.ts`)
   - TypeScript interfaces for events
   - Payload definitions
   - Configuration types

## Configuration

### Environment Variables

```env
PORT=3000              # HTTP server port
PORT_WS=3001           # WebSocket port (optional, defaults to same as HTTP)
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

### Default Settings

```typescript
{
  port: 3001,
  corsOrigin: ['http://localhost:5173', 'http://localhost:3000'],
  pingTimeout: 20000,      // 20 seconds
  pingInterval: 25000,     // 25 seconds
  connectionTimeout: 45000, // 45 seconds
  maxReconnectAttempts: 3,
  reconnectDelay: 1000,
  maxReconnectDelay: 5000
}
```

## Namespaces

### 1. Main Namespace (`/`)
Default namespace for general connections.

### 2. Leaderboard Namespace (`/leaderboard`)
**Events:**
- `leaderboard:subscribe(category?)` - Subscribe to leaderboard updates
- `leaderboard:unsubscribe(category?)` - Unsubscribe from updates
- `leaderboard:update` - Receive leaderboard updates
- `leaderboard:rankChange` - Receive rank change notifications

**Example:**
```typescript
const socket = io('http://localhost:3000/leaderboard');
socket.emit('leaderboard:subscribe', 'overall');
socket.on('leaderboard:update', (data) => {
  console.log('Leaderboard updated:', data);
});
```

### 3. Matches Namespace (`/matches`)
**Events:**
- `match:subscribe(matchId)` - Subscribe to match updates
- `match:unsubscribe(matchId)` - Unsubscribe from match
- `match:created` - New match created
- `match:updated` - Match updated
- `match:completed` - Match completed

**Example:**
```typescript
const socket = io('http://localhost:3000/matches');
socket.emit('match:subscribe', 'match-123');
socket.on('match:updated', (data) => {
  console.log('Match updated:', data);
});
```

### 4. Players Namespace (`/players`)
**Events:**
- `player:subscribe(playerId)` - Subscribe to player updates
- `player:unsubscribe(playerId)` - Unsubscribe from player
- `player:updated` - Player data updated
- `player:eloChange` - Player ELO changed

**Example:**
```typescript
const socket = io('http://localhost:3000/players');
socket.emit('player:subscribe', 'player-456');
socket.on('player:eloChange', (data) => {
  console.log('ELO changed:', data);
});
```

## Room-Based Broadcasting

### Room Naming Convention

```
leaderboard:all        # All leaderboard updates
leaderboard:{category} # Category-specific updates
match:{matchId}        # Match-specific events
player:{playerId}      # Player-specific events
```

### Broadcasting Examples

```typescript
import { getWebSocketServer } from './websocket/server';

const wsServer = getWebSocketServer();
const connectionManager = wsServer.getConnectionManager();

// Broadcast to all clients in a room
connectionManager.broadcastToRoom(
  'leaderboard:overall',
  'leaderboard:update',
  {
    category: 'overall',
    players: [...],
    timestamp: Date.now()
  }
);

// Broadcast to namespace
connectionManager.broadcastToNamespace(
  NamespaceType.MATCHES,
  'match:created',
  {
    id: 'match-123',
    player1Id: 'p1',
    player2Id: 'p2',
    timestamp: Date.now()
  }
);
```

## Connection Lifecycle

### 1. Connection
```typescript
socket.on('connection:established', (data) => {
  console.log('Connected:', data.socketId);
  console.log('Session:', data.sessionId);
});
```

### 2. Disconnection
Automatic cleanup of:
- Room subscriptions
- Connection state
- Metrics

### 3. Reconnection
- Up to 3 automatic reconnection attempts
- Exponential backoff (1s → 5s max)
- Session restoration (future enhancement)

## Health Check

### Ping/Pong
```typescript
// Client
socket.emit('ping');
socket.on('pong', (timestamp) => {
  const latency = Date.now() - timestamp;
  console.log('Latency:', latency, 'ms');
});
```

### Metrics Endpoint
```typescript
import { getWebSocketServer } from './websocket/server';

const metrics = getWebSocketServer().getMetrics();
console.log('Active connections:', metrics.activeConnections);
console.log('Total connections:', metrics.totalConnections);
console.log('Uptime:', metrics.uptime);
```

## Integration with Services

### Leaderboard Service Example

```typescript
import { getWebSocketServer } from '../websocket/server';
import { LeaderboardUpdatePayload } from '../websocket/types';

export class LeaderboardService {
  async updateLeaderboard(category: string) {
    // Update database...
    const players = await this.getTopPlayers(category);

    // Broadcast to WebSocket clients
    const wsServer = getWebSocketServer();
    const payload: LeaderboardUpdatePayload = {
      category,
      players,
      timestamp: Date.now()
    };

    wsServer.broadcastToRoom(
      `leaderboard:${category}`,
      'leaderboard:update',
      payload
    );
  }
}
```

### Match Service Example

```typescript
import { getWebSocketServer } from '../websocket/server';
import { MatchPayload } from '../websocket/types';

export class MatchService {
  async createMatch(player1Id: string, player2Id: string) {
    // Create match in database...
    const match = await this.create({ player1Id, player2Id });

    // Broadcast to WebSocket clients
    const wsServer = getWebSocketServer();
    const payload: MatchPayload = {
      id: match.id,
      player1Id,
      player2Id,
      timestamp: Date.now()
    };

    wsServer.broadcastToNamespace(
      NamespaceType.MATCHES,
      'match:created',
      payload
    );
  }
}
```

## Client-Side Integration

### React Hook Example

```typescript
import { useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';

export function useLeaderboard(category: string) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const newSocket = io('http://localhost:3000/leaderboard');
    setSocket(newSocket);

    newSocket.on('connection:established', (data) => {
      console.log('Connected:', data.sessionId);
    });

    newSocket.emit('leaderboard:subscribe', category);

    newSocket.on('leaderboard:update', (data) => {
      setLeaderboard(data.players);
    });

    return () => {
      newSocket.emit('leaderboard:unsubscribe', category);
      newSocket.close();
    };
  }, [category]);

  return { leaderboard, socket };
}
```

## Security Considerations

1. **CORS Configuration**
   - Only allow trusted origins
   - Configure in environment variables

2. **Authentication** (Future Enhancement)
   - Add JWT token validation
   - Implement per-namespace authentication

3. **Rate Limiting** (Future Enhancement)
   - Limit connection attempts
   - Limit message frequency

4. **Input Validation**
   - Validate all client events
   - Sanitize room names

## Monitoring

### Metrics Tracked
- Total connections
- Active connections
- Total rooms
- Messages sent/received
- Errors
- Reconnections
- Uptime

### Logging
- Connection/disconnection events
- Room join/leave events
- Error events
- Metrics snapshots (every 5 minutes)

## Testing

### Manual Testing
```bash
# Install wscat
npm install -g wscat

# Connect to WebSocket
wscat -c ws://localhost:3000

# Send events
> {"event": "ping"}
```

### Automated Testing
See `src/__tests__/websocket/` for test examples.

## Troubleshooting

### Connection Issues
1. Check CORS configuration
2. Verify port is not blocked
3. Check firewall settings

### Performance Issues
1. Monitor connection count
2. Check for memory leaks
3. Review room subscription patterns

### Debugging
```typescript
// Enable Socket.io debug mode
localStorage.debug = 'socket.io-client:*';
```

## Future Enhancements

- [ ] JWT authentication
- [ ] Redis adapter for horizontal scaling
- [ ] Message queuing for offline clients
- [ ] Session restoration on reconnect
- [ ] Rate limiting per client
- [ ] Compression for large payloads
- [ ] Binary event support
- [ ] Custom middleware for events
