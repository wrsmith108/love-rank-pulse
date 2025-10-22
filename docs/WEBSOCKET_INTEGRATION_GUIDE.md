# WebSocket Integration Guide

## Quick Start

### 1. Server Setup

The WebSocket server is automatically initialized when the Express server starts.

```typescript
import { createServer } from 'http';
import express from 'express';
import { initializeWebSocketServer } from './websocket/server';

const app = express();
const httpServer = createServer(app);

// Initialize WebSocket server
const io = initializeWebSocketServer(httpServer);

httpServer.listen(3000);
```

### 2. Broadcasting from Services

#### Leaderboard Updates

```typescript
import { getWebSocketServer } from './websocket/server';
import { LeaderboardUpdatePayload } from './websocket/types';

export class LeaderboardService {
  async updateRankings(category: string) {
    // Update database
    const players = await this.getTopPlayers(category, 100);

    // Broadcast to WebSocket clients
    const wsServer = getWebSocketServer();
    const payload: LeaderboardUpdatePayload = {
      category,
      players: players.map(p => ({
        id: p.id,
        name: p.name,
        rank: p.rank,
        elo: p.elo,
        wins: p.wins,
        losses: p.losses,
        winRate: p.winRate
      })),
      timestamp: Date.now()
    };

    // Broadcast to all subscribers of this category
    wsServer.broadcastToRoom(
      `leaderboard:${category}`,
      'leaderboard:update',
      payload
    );
  }

  async updatePlayerRank(playerId: string, oldRank: number, newRank: number, category: string) {
    const wsServer = getWebSocketServer();
    const player = await this.getPlayer(playerId);

    const payload: RankChangePayload = {
      playerId,
      playerName: player.name,
      oldRank,
      newRank,
      category,
      timestamp: Date.now()
    };

    wsServer.broadcastToRoom(
      `leaderboard:${category}`,
      'leaderboard:rankChange',
      payload
    );
  }
}
```

#### Match Events

```typescript
import { getWebSocketServer } from './websocket/server';
import { MatchPayload, NamespaceType } from './websocket/types';

export class MatchService {
  async createMatch(player1Id: string, player2Id: string, category?: string) {
    // Create match in database
    const match = await this.create({ player1Id, player2Id, category });

    // Broadcast to all match subscribers
    const wsServer = getWebSocketServer();
    const payload: MatchPayload = {
      id: match.id,
      player1Id,
      player2Id,
      category,
      timestamp: Date.now()
    };

    wsServer.broadcastToNamespace(
      NamespaceType.MATCHES,
      'match:created',
      payload
    );

    return match;
  }

  async updateMatch(matchId: string, winner: string) {
    // Update database
    const match = await this.update(matchId, { winner });

    // Broadcast to match subscribers
    const wsServer = getWebSocketServer();
    const payload: MatchPayload = {
      id: matchId,
      player1Id: match.player1Id,
      player2Id: match.player2Id,
      winner,
      player1Elo: match.player1Elo,
      player2Elo: match.player2Elo,
      category: match.category,
      timestamp: Date.now()
    };

    // Broadcast to specific match room
    wsServer.broadcastToRoom(
      `match:${matchId}`,
      'match:updated',
      payload
    );

    // Also broadcast to namespace
    wsServer.broadcastToNamespace(
      NamespaceType.MATCHES,
      'match:updated',
      payload
    );
  }
}
```

#### Player ELO Changes

```typescript
import { getWebSocketServer } from './websocket/server';
import { EloChangePayload } from './websocket/types';

export class PlayerService {
  async updateElo(playerId: string, newElo: number, matchId: string) {
    // Get current ELO
    const player = await this.getPlayer(playerId);
    const oldElo = player.elo;

    // Update database
    await this.update(playerId, { elo: newElo });

    // Broadcast ELO change
    const wsServer = getWebSocketServer();
    const payload: EloChangePayload = {
      playerId,
      playerName: player.name,
      oldElo,
      newElo,
      change: newElo - oldElo,
      matchId,
      timestamp: Date.now()
    };

    // Broadcast to player subscribers
    wsServer.broadcastToRoom(
      `player:${playerId}`,
      'player:eloChange',
      payload
    );
  }
}
```

## Client-Side Integration

### React Hooks

#### useLeaderboard Hook

```typescript
import { useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import { LeaderboardUpdatePayload } from '../types/websocket';

export function useLeaderboard(category: string = 'overall') {
  const [leaderboard, setLeaderboard] = useState<LeaderboardUpdatePayload | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const newSocket = io('http://localhost:3000/leaderboard', {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to leaderboard namespace');
      setIsConnected(true);
    });

    newSocket.on('connection:established', (data) => {
      console.log('Connection established:', data.sessionId);
      // Subscribe to category
      newSocket.emit('leaderboard:subscribe', category);
    });

    newSocket.on('leaderboard:update', (data: LeaderboardUpdatePayload) => {
      console.log('Leaderboard updated:', data);
      setLeaderboard(data);
    });

    newSocket.on('leaderboard:rankChange', (data) => {
      console.log('Rank changed:', data);
      // Handle rank change notification
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from leaderboard');
      setIsConnected(false);
    });

    newSocket.on('connection:error', (error) => {
      console.error('WebSocket error:', error);
    });

    return () => {
      newSocket.emit('leaderboard:unsubscribe', category);
      newSocket.close();
    };
  }, [category]);

  return { leaderboard, socket, isConnected };
}
```

#### useMatch Hook

```typescript
import { useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import { MatchPayload } from '../types/websocket';

export function useMatch(matchId: string) {
  const [match, setMatch] = useState<MatchPayload | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!matchId) return;

    const newSocket = io('http://localhost:3000/matches');
    setSocket(newSocket);

    newSocket.on('connection:established', () => {
      newSocket.emit('match:subscribe', matchId);
    });

    newSocket.on('match:updated', (data: MatchPayload) => {
      if (data.id === matchId) {
        setMatch(data);
      }
    });

    newSocket.on('match:completed', (data: MatchPayload) => {
      if (data.id === matchId) {
        setMatch(data);
      }
    });

    return () => {
      newSocket.emit('match:unsubscribe', matchId);
      newSocket.close();
    };
  }, [matchId]);

  return { match, socket };
}
```

#### usePlayerUpdates Hook

```typescript
import { useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import { PlayerPayload, EloChangePayload } from '../types/websocket';

export function usePlayerUpdates(playerId: string) {
  const [player, setPlayer] = useState<PlayerPayload | null>(null);
  const [lastEloChange, setLastEloChange] = useState<EloChangePayload | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!playerId) return;

    const newSocket = io('http://localhost:3000/players');
    setSocket(newSocket);

    newSocket.on('connection:established', () => {
      newSocket.emit('player:subscribe', playerId);
    });

    newSocket.on('player:updated', (data: PlayerPayload) => {
      if (data.id === playerId) {
        setPlayer(data);
      }
    });

    newSocket.on('player:eloChange', (data: EloChangePayload) => {
      if (data.playerId === playerId) {
        setLastEloChange(data);
      }
    });

    return () => {
      newSocket.emit('player:unsubscribe', playerId);
      newSocket.close();
    };
  }, [playerId]);

  return { player, lastEloChange, socket };
}
```

### React Components

#### Leaderboard Component

```typescript
import React from 'react';
import { useLeaderboard } from '../hooks/useLeaderboard';

export function Leaderboard({ category = 'overall' }) {
  const { leaderboard, isConnected } = useLeaderboard(category);

  return (
    <div>
      <div className="flex items-center gap-2">
        <h2>Leaderboard - {category}</h2>
        <span className={`status ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '🟢 Live' : '🔴 Offline'}
        </span>
      </div>

      {leaderboard && (
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              <th>ELO</th>
              <th>W-L</th>
              <th>Win Rate</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.players.map((player) => (
              <tr key={player.id}>
                <td>{player.rank}</td>
                <td>{player.name}</td>
                <td>{player.elo}</td>
                <td>{player.wins}-{player.losses}</td>
                <td>{(player.winRate * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

#### Live Match Component

```typescript
import React from 'react';
import { useMatch } from '../hooks/useMatch';

export function LiveMatch({ matchId }) {
  const { match } = useMatch(matchId);

  if (!match) return <div>Loading...</div>;

  return (
    <div className="live-match">
      <h3>Match {matchId}</h3>
      <div className="players">
        <div className="player">
          <span>{match.player1Id}</span>
          {match.player1Elo && <span>ELO: {match.player1Elo}</span>}
        </div>
        <span>vs</span>
        <div className="player">
          <span>{match.player2Id}</span>
          {match.player2Elo && <span>ELO: {match.player2Elo}</span>}
        </div>
      </div>
      {match.winner && (
        <div className="winner">
          Winner: {match.winner}
        </div>
      )}
    </div>
  );
}
```

## Environment Configuration

```env
# .env file
PORT=3000
PORT_WS=3001  # Optional, defaults to same as PORT
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
NODE_ENV=development
```

## Testing

### Integration Tests

```typescript
import { io as ioClient } from 'socket.io-client';
import { WebSocketServer } from '../websocket/server';

describe('WebSocket Integration', () => {
  let wsServer: WebSocketServer;
  let clientSocket: any;

  beforeAll(() => {
    wsServer = new WebSocketServer({ port: 3002 });
    wsServer.initialize();
  });

  afterAll(async () => {
    await wsServer.shutdown();
  });

  beforeEach((done) => {
    clientSocket = ioClient('http://localhost:3002');
    clientSocket.on('connect', done);
  });

  afterEach(() => {
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  it('should receive leaderboard updates', (done) => {
    const leaderboardSocket = ioClient('http://localhost:3002/leaderboard');

    leaderboardSocket.on('connection:established', () => {
      leaderboardSocket.emit('leaderboard:subscribe', 'overall');
    });

    leaderboardSocket.on('leaderboard:update', (data) => {
      expect(data).toHaveProperty('category');
      expect(data).toHaveProperty('players');
      leaderboardSocket.disconnect();
      done();
    });

    // Trigger update from server
    setTimeout(() => {
      wsServer.broadcastToRoom('leaderboard:overall', 'leaderboard:update', {
        category: 'overall',
        players: [],
        timestamp: Date.now()
      });
    }, 100);
  });
});
```

## Monitoring

### Health Check

```typescript
import { getWebSocketServer } from './websocket/server';

app.get('/api/websocket/health', (req, res) => {
  const wsServer = getWebSocketServer();
  const metrics = wsServer.getMetrics();

  res.json({
    status: 'healthy',
    metrics: {
      activeConnections: metrics.activeConnections,
      totalConnections: metrics.totalConnections,
      uptime: metrics.uptime,
      messagesSent: metrics.messagesSent,
      messagesReceived: metrics.messagesReceived
    }
  });
});
```

## Best Practices

1. **Always unsubscribe on cleanup**
   ```typescript
   useEffect(() => {
     // ... setup
     return () => {
       socket.emit('leaderboard:unsubscribe', category);
       socket.close();
     };
   }, [category]);
   ```

2. **Handle reconnection**
   ```typescript
   socket.on('reconnect', (attemptNumber) => {
     console.log('Reconnected after', attemptNumber, 'attempts');
     // Re-subscribe to rooms
     socket.emit('leaderboard:subscribe', category);
   });
   ```

3. **Error handling**
   ```typescript
   socket.on('connection:error', (error) => {
     console.error('WebSocket error:', error);
     // Show user-friendly error message
   });
   ```

4. **Type safety**
   - Use TypeScript interfaces for all payloads
   - Define client/server events upfront
   - Use typed socket instances

## Troubleshooting

See [WEBSOCKET_SETUP.md](./WEBSOCKET_SETUP.md) for detailed troubleshooting guide.
