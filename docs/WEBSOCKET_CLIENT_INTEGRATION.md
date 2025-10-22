# WebSocket Client Integration

## Overview
Successfully integrated Socket.io client for real-time leaderboard and match updates.

## Components Created

### 1. WebSocketContext (`src/contexts/WebSocketContext.tsx`)
**Features:**
- JWT authentication via `socket.handshake.auth.token`
- 4 namespace connections: `/`, `/leaderboard`, `/matches`, `/players`
- Connection state management (disconnected, connecting, connected, reconnecting, error)
- Auto-reconnection with exponential backoff (1s - 5s, max 5 attempts)
- Room subscription management

**Methods:**
- `connect()` - Connect to all namespaces
- `disconnect()` - Disconnect from all namespaces
- `subscribeToLeaderboard(scope)` - Subscribe to leaderboard updates
- `unsubscribeFromLeaderboard(scope)` - Unsubscribe from updates
- `subscribeToMatches(matchId?)` - Subscribe to match events
- `unsubscribeFromMatches(matchId?)` - Unsubscribe from match events

**Configuration:**
```typescript
url: process.env.VITE_WS_URL || 'http://localhost:3000'
autoConnect: true (default)
```

### 2. useWebSocket Hook (`src/hooks/useWebSocket.ts`)
**Purpose:** Main WebSocket connection management

**Returns:**
- `connectionState` - Current connection state
- `isConnected` - Boolean connection status
- `error` - Connection error message
- `socket` - Main socket instance
- `connect()` - Manual connect
- `disconnect()` - Manual disconnect

### 3. useRealtimeLeaderboard Hook (`src/hooks/useRealtimeLeaderboard.ts`)
**Purpose:** Subscribe to and handle leaderboard updates

**Parameters:**
```typescript
{
  scope: SubscriptionScope;           // 'global' | 'country:{code}' | 'session:{id}'
  autoSubscribe?: boolean;            // Auto-subscribe on mount
  onRankChange?: (RankChangeEvent) => void;
  onLeaderboardUpdate?: (LeaderboardUpdateEvent) => void;
}
```

**Returns:**
- `isConnected` - Connection status
- `lastUpdate` - Timestamp of last update
- `updateCount` - Number of updates received
- `subscribe()` - Manual subscribe
- `unsubscribe()` - Manual unsubscribe

**Events Handled:**
- `rankChange` - Individual player rank changes
- `leaderboardUpdate` - Full leaderboard refresh

### 4. useLiveMatchEvents Hook (`src/hooks/useLiveMatchEvents.ts`)
**Purpose:** Subscribe to and handle live match events

**Parameters:**
```typescript
{
  matchId?: string;                   // Specific match ID or all matches
  autoSubscribe?: boolean;            // Auto-subscribe on mount
  onMatchEvent?: (MatchEvent) => void;
  onMatchStart?: (MatchEvent) => void;
  onMatchEnd?: (MatchEvent) => void;
  onKill?: (MatchEvent) => void;
  onDeath?: (MatchEvent) => void;
  onObjective?: (MatchEvent) => void;
}
```

**Returns:**
- `isConnected` - Connection status
- `lastEvent` - Last match event received
- `eventCount` - Number of events received
- `matchStarted` - Match started flag
- `matchEnded` - Match ended flag
- `subscribe()` - Manual subscribe
- `unsubscribe()` - Manual unsubscribe
- `resetMatchState()` - Reset match state flags

**Event Types:**
- `start` - Match started
- `end` - Match ended
- `kill` - Player kill event
- `death` - Player death event
- `objective` - Objective completed

## Integration

### App.tsx
Wrapped application with `WebSocketProvider`:
```tsx
<AuthProvider>
  <WebSocketProvider autoConnect={true}>
    {/* App content */}
  </WebSocketProvider>
</AuthProvider>
```

### Index.tsx
Integrated real-time updates:
```tsx
// WebSocket connection
const { isConnected, connectionState } = useWebSocket();

// Subscribe to leaderboard updates based on active tab
const { lastUpdate, updateCount } = useRealtimeLeaderboard({
  scope: getSubscriptionScope(),
  autoSubscribe: true,
  onRankChange: handleRankChange,
  onLeaderboardUpdate: handleLeaderboardUpdate
});

// Subscribe to live match events (session tab only)
const { matchStarted, matchEnded, eventCount } = useLiveMatchEvents({
  matchId: activeTab === "session" ? currentSessionId : undefined,
  autoSubscribe: activeTab === "session",
  onMatchEvent: (event) => console.log("Match event:", event)
});
```

**UI Updates:**
- Live indicator showing connection status
- Update count and event count display
- Real-time rank changes in leaderboard table
- Last update timestamp in footer

## WebSocket Events

### Leaderboard Events
```typescript
// Subscribe
socket.emit('subscribe', { scope: 'global' | 'country:US' | 'session:4721' });

// Listen
socket.on('rankChange', (data: RankChangeEvent) => {
  // player_id, player_name, old_rank, new_rank, scope, timestamp
});

socket.on('leaderboardUpdate', (data: LeaderboardUpdateEvent) => {
  // scope, players[], total_count, timestamp
});

// Unsubscribe
socket.emit('unsubscribe', { scope });
```

### Match Events
```typescript
// Subscribe
socket.emit('subscribe', { room: 'match:4721' | 'matches' });

// Listen
socket.on('matchEvent', (data: MatchEvent) => {
  // match_id, event_type, player_id?, data, timestamp
});

// Unsubscribe
socket.emit('unsubscribe', { room });
```

## Testing

To test the WebSocket integration:

1. **Start Backend Server:**
   ```bash
   npm run dev
   ```
   Server runs at `http://localhost:3000` with WebSocket server

2. **Start Frontend:**
   ```bash
   npm run dev
   ```

3. **Verify Connection:**
   - Check browser console for connection logs
   - Look for "Live" indicator on session tab
   - Watch for `[WebSocket] Connected to {namespace}` messages

4. **Test Real-time Updates:**
   - Trigger leaderboard updates from backend
   - Watch for rank changes in UI
   - Check update counter incrementing

## Environment Variables

Add to `.env`:
```env
VITE_WS_URL=http://localhost:3000
```

## Dependencies

```json
{
  "socket.io-client": "^4.x.x"
}
```

## Coordination Hooks

All files tracked via Claude Flow hooks:
- `swarm/coder/websocket-context`
- `swarm/coder/use-websocket`
- `swarm/coder/realtime-leaderboard`
- `swarm/coder/live-match-events`
- `swarm/shared/websocket-client` (coordination memory)

## Files Modified

### Created:
- `/workspaces/love-rank-pulse/src/contexts/WebSocketContext.tsx`
- `/workspaces/love-rank-pulse/src/hooks/useWebSocket.ts`
- `/workspaces/love-rank-pulse/src/hooks/useRealtimeLeaderboard.ts`
- `/workspaces/love-rank-pulse/src/hooks/useLiveMatchEvents.ts`

### Updated:
- `/workspaces/love-rank-pulse/src/App.tsx` - Added WebSocketProvider
- `/workspaces/love-rank-pulse/src/pages/Index.tsx` - Integrated real-time updates

## Next Steps

1. **Test with Live Server:**
   - Verify WebSocket server is running
   - Test authentication flow
   - Validate event handlers

2. **Add Error Handling UI:**
   - Connection error notifications
   - Reconnection progress indicator
   - Fallback to polling if WebSocket fails

3. **Optimize Performance:**
   - Debounce rapid updates
   - Batch rank changes
   - Implement update throttling

4. **Add Analytics:**
   - Track connection uptime
   - Monitor update latency
   - Log event types received

## Troubleshooting

### Connection Issues
- Verify JWT token in localStorage (`love-rank-pulse-token`)
- Check CORS settings on backend
- Ensure WebSocket server is running
- Check browser console for errors

### No Updates Received
- Verify subscription scope matches server rooms
- Check server logs for event emissions
- Confirm socket.io versions match (client/server)
- Test with socket.io-client devtools

### Performance Issues
- Limit update frequency on server
- Implement client-side debouncing
- Use React.memo for leaderboard components
- Consider virtual scrolling for large lists

---

**Status:** ✅ Complete
**Date:** 2025-10-22
**Agent:** Coder (WebSocket Integration Specialist)
