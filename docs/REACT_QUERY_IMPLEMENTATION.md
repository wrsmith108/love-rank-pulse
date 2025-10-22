# React Query Implementation Guide

## Overview

React Query (@tanstack/react-query) has been integrated for intelligent API state management, caching, and real-time optimistic updates.

## Files Created

### Core Configuration

1. **`/src/config/queryKeys.ts`** - Centralized query key factory
   - Standardized query keys for leaderboard, player stats, and matches
   - Type-safe query key generation
   - Simplifies cache invalidation

### React Query Hooks

2. **`/src/hooks/useLeaderboard.ts`** - Leaderboard data hook
   - Automatic caching with configurable stale times
   - Background refetching (30s for session, 60s for country/global)
   - Optimistic updates for player data
   - Manual refresh capability
   - Prefetching support

3. **`/src/hooks/usePlayerStats.ts`** - Player statistics hook
   - Longer cache times (5 minutes)
   - Automatic background refetching
   - Optimistic updates for real-time stat changes
   - Stat increment utilities

4. **`/src/hooks/useLeaderboardMutations.ts`** - Player actions/mutations
   - Add friend with optimistic updates
   - Report player
   - Vote kick
   - Manual refresh
   - Automatic rollback on errors

### WebSocket Integration

5. **`/src/contexts/WebSocketContext.tsx`** - WebSocket provider with React Query sync
   - Auto-connect/reconnect functionality
   - Real-time event handling (player_update, rank_change, stats_update, match_end)
   - Automatic query cache updates on WebSocket events
   - Connection state management

### App Configuration

6. **`/src/App.tsx`** - Updated with QueryClient configuration
   - Optimal cache settings (1min stale, 5min cache)
   - Retry logic with exponential backoff
   - React Query DevTools (dev only)
   - WebSocketProvider integration

## Query Configuration

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60000,        // 1 minute - data is fresh
      gcTime: 300000,          // 5 minutes - cache retention
      retry: 3,                // Retry failed requests
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: true,
    },
    mutations: {
      retry: 1,
      retryDelay: 1000,
    },
  },
});
```

## Usage Examples

### Fetching Leaderboard Data

```typescript
import { useLeaderboard } from '@/hooks/useLeaderboard';

function LeaderboardComponent() {
  const { data, isLoading, error, refresh, optimisticUpdate } = useLeaderboard({
    tab: 'session',
    sortBy: 'rank',
    limit: 10,
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {data.players.map((player) => (
        <PlayerCard key={player.player_id} player={player} />
      ))}
      <button onClick={refresh}>Refresh</button>
    </div>
  );
}
```

### Using Player Stats

```typescript
import { usePlayerStats } from '@/hooks/usePlayerStats';

function PlayerStatsModal() {
  const { data, isLoading, optimisticUpdate } = usePlayerStats('current');

  // Optimistically update when WebSocket event received
  useEffect(() => {
    if (wsEvent?.type === 'stat_change') {
      optimisticUpdate({ kills: data.kills + 1 });
    }
  }, [wsEvent]);

  return <StatsDisplay stats={data} />;
}
```

### Mutations with Optimistic Updates

```typescript
import { useAddFriend } from '@/hooks/useLeaderboardMutations';

function PlayerActions({ playerId, playerName }) {
  const addFriend = useAddFriend();

  const handleAddFriend = () => {
    addFriend.mutate(
      { playerId, playerName },
      {
        onSuccess: () => {
          toast.success('Friend added!');
        },
        onError: () => {
          toast.error('Failed to add friend');
        },
      }
    );
  };

  return (
    <button onClick={handleAddFriend} disabled={addFriend.isPending}>
      {addFriend.isPending ? 'Adding...' : 'Add Friend'}
    </button>
  );
}
```

### WebSocket Integration

```typescript
import { useWebSocket } from '@/contexts/WebSocketContext';

function App() {
  const { isConnected, connect, disconnect } = useWebSocket();

  return (
    <div>
      <ConnectionStatus connected={isConnected} />
      {/* WebSocket automatically syncs with React Query cache */}
    </div>
  );
}
```

## Cache Invalidation Strategy

### Automatic Invalidation

- **WebSocket Events**: Automatic cache updates on real-time events
- **Window Focus**: Refetch when user returns to tab
- **Reconnect**: Refetch when connection restored
- **Mount**: Fresh data on component mount

### Manual Invalidation

```typescript
// Invalidate specific query
queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard.list(filters) });

// Invalidate all leaderboard queries
queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard.all });

// Force immediate refetch
queryClient.invalidateQueries({
  queryKey: queryKeys.leaderboard.all,
  refetchType: 'active',
});
```

## Optimistic Updates Pattern

1. **Before mutation**: Snapshot current cache
2. **Optimistically update**: Immediately update UI
3. **On error**: Rollback to snapshot
4. **On success**: Invalidate and refetch for server truth

```typescript
onMutate: async (params) => {
  await queryClient.cancelQueries({ queryKey });
  const previousData = queryClient.getQueryData(queryKey);
  queryClient.setQueryData(queryKey, (old) => ({...old, ...optimisticChanges}));
  return { previousData };
},
onError: (err, vars, context) => {
  queryClient.setQueryData(queryKey, context.previousData);
},
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey });
},
```

## Background Refetching

### Session Leaderboard
- **Stale Time**: 10 seconds
- **Refetch Interval**: 30 seconds
- **Reason**: Highly dynamic during active matches

### Country/Global Leaderboards
- **Stale Time**: 60 seconds
- **Refetch Interval**: Disabled (only on focus/reconnect)
- **Reason**: Less frequently changing data

### Player Stats
- **Stale Time**: 5 minutes
- **Refetch Interval**: 5 minutes
- **Reason**: Aggregate stats change slowly

## DevTools

React Query DevTools are enabled in development mode:

```typescript
{process.env.NODE_ENV === 'development' && (
  <ReactQueryDevtools initialIsOpen={false} position="bottom-right" />
)}
```

Access via bottom-right icon to:
- Inspect query cache
- View query states (loading, error, stale, fresh)
- Manually invalidate queries
- Monitor refetch behavior
- Debug optimistic updates

## Performance Benefits

1. **Intelligent Caching**: Avoid redundant network requests
2. **Background Updates**: Keep data fresh without user action
3. **Optimistic UI**: Instant feedback on user actions
4. **Automatic Retries**: Handle transient failures gracefully
5. **Request Deduplication**: Multiple components can share same query
6. **Garbage Collection**: Automatic cleanup of unused cache entries

## Next Steps

1. Replace mock data with actual API calls
2. Add error boundaries for query errors
3. Implement pagination with `useInfiniteQuery`
4. Add loading skeletons with `isPending` states
5. Set up query cache persistence
6. Add analytics for cache hit rates

## Testing

Test files should mock React Query:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const wrapper = ({ children }) => (
  <QueryClientProvider client={createTestQueryClient()}>
    {children}
  </QueryClientProvider>
);
```

## Related Files

- `/src/App.tsx` - QueryClient provider setup
- `/src/pages/Index.tsx` - Main consumer (to be updated)
- `/src/services/LeaderboardService.ts` - Backend service (API layer)
- `/src/services/PlayerService.ts` - Player data service
