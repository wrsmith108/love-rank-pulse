# Frontend API Integration Guide

## Overview

This guide documents the complete integration of real API calls in the frontend, replacing mock data with production-ready backend services.

## Architecture

```
Frontend (React + TypeScript)
├── API Client Layer (axios)
│   ├── Request/Response Interceptors
│   ├── JWT Token Management
│   └── Error Handling
├── React Query Layer (TanStack Query)
│   ├── Data Fetching
│   ├── Caching Strategy
│   └── Automatic Refetching
└── UI Layer (Components + Hooks)
    ├── Loading States
    ├── Error Handling
    └── Real-time Updates (WebSocket)
```

## Files Created

### 1. API Client Utility
**File**: `/workspaces/love-rank-pulse/src/utils/apiClient.ts`

**Features**:
- Centralized axios instance with configurable baseURL
- JWT token management (localStorage-based)
- Automatic token injection in request headers
- Token refresh on 401 errors
- Comprehensive error handling
- TypeScript type safety

**Configuration**:
```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
```

**Token Management**:
```typescript
tokenManager.getToken()      // Retrieve stored token
tokenManager.setToken(token) // Store new token
tokenManager.clearTokens()   // Clear all tokens
tokenManager.isAuthenticated() // Check auth status
```

### 2. Leaderboard Hook
**File**: `/workspaces/love-rank-pulse/src/hooks/useLeaderboard.ts`

**Features**:
- Fetch leaderboard data by scope (session/country/global)
- Time period filtering (session/daily/weekly/monthly/alltime)
- Pagination support
- Automatic refetching for live sessions
- React Query integration with smart caching

**Usage**:
```typescript
const { data, isLoading, error, refetch } = useLeaderboard({
  scope: 'session',
  timePeriod: 'session',
  limit: 100,
  refetchInterval: 5000, // Auto-refresh every 5 seconds
});
```

**Cache Strategy**:
- Session: 30s stale time, 5min cache
- Country: 2min stale time, 10min cache
- Global: 5min stale time, 15min cache

### 3. Player Stats Hook
**File**: `/workspaces/love-rank-pulse/src/hooks/usePlayerStats.ts`

**Features**:
- Fetch current user or specific player statistics
- Comprehensive stats (combat, win/loss, rankings)
- Recent match history
- Rank percentiles

**Usage**:
```typescript
// Current user stats
const { data, isLoading, error } = usePlayerStats({
  includeRecentMatches: true,
});

// Specific player stats
const { data } = usePlayerStats({
  playerId: '123',
  includeRecentMatches: false,
});
```

### 4. Authentication Hook
**File**: `/workspaces/love-rank-pulse/src/hooks/useAuth.ts`

**Features**:
- User authentication state management
- Login/logout/register functionality
- Token persistence
- Automatic token refresh
- User profile management

**Usage**:
```typescript
const {
  user,
  isLoading,
  isAuthenticated,
  login,
  logout,
  register
} = useAuth();

// Login
await login({ email, password });

// Register
await register({ email, password, username, player_name, country_code });

// Logout
await logout();
```

### 5. Updated Index Page
**File**: `/workspaces/love-rank-pulse/src/pages/Index.tsx`

**Changes**:
- Replaced hardcoded mock data with real API calls
- Added loading states during data fetching
- Comprehensive error handling with user feedback
- Fallback to mock data when API is unavailable
- Preserved WebSocket integration for real-time updates
- Dynamic player stats based on active tab
- Retry functionality for failed requests

**Features**:
- Automatic data transformation (backend → frontend format)
- Smart refetching (5s interval for session tab)
- Error toast notifications
- Loading skeletons
- No data states
- ErrorBoundary integration

## Environment Configuration

**File**: `/workspaces/love-rank-pulse/.env.example`

```bash
# Backend API Base URL
VITE_API_BASE_URL=http://localhost:3000/api

# WebSocket Server URL
VITE_WS_URL=ws://localhost:3000

# Feature Flags
VITE_ENABLE_REALTIME=true
VITE_ENABLE_WEBSOCKETS=true
```

**Setup**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

## API Endpoints Used

### Leaderboard Endpoints
```
GET /api/leaderboard?scope={scope}&period={period}&page={page}&limit={limit}
GET /api/leaderboard?scope=session&session_id={id}
GET /api/leaderboard?scope=country&country_code={code}
```

### Player Endpoints
```
GET /api/players/me/stats?include_recent_matches=true
GET /api/players/{player_id}/stats
```

### Authentication Endpoints
```
POST /api/auth/login
POST /api/auth/register
POST /api/auth/logout
POST /api/auth/refresh
GET /api/auth/me
```

## Data Flow

### 1. Initial Page Load
```
User opens page
  ↓
useLeaderboard hook fetches data
  ↓
API Client adds JWT token (if available)
  ↓
Backend returns leaderboard data
  ↓
Data transformed to frontend format
  ↓
React Query caches response
  ↓
UI renders with real data
```

### 2. Real-time Updates
```
WebSocket connects
  ↓
Subscribe to scope (session/country/global)
  ↓
Receive rank change events
  ↓
Update local state
  ↓
Re-render with new ranks
```

### 3. Error Handling
```
API request fails
  ↓
apiClient catches error
  ↓
Check if 401 (unauthorized)
  ↓
If yes: Attempt token refresh
  ↓
If refresh fails: Redirect to login
  ↓
If other error: Show toast notification
  ↓
Fallback to cached/mock data
```

## Testing

### Local Development
1. Start backend server:
   ```bash
   cd backend
   npm run dev
   ```

2. Start frontend:
   ```bash
   npm run dev
   ```

3. Open browser: `http://localhost:5173`

### Testing API Integration
```bash
# Check leaderboard endpoint
curl http://localhost:3000/api/leaderboard?scope=session

# Check player stats (requires auth)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/players/me/stats
```

## Error Handling Strategy

### Network Errors
- Show toast notification
- Retry button in UI
- Fallback to cached data
- Graceful degradation

### Authentication Errors
- Automatic token refresh attempt
- Redirect to login if refresh fails
- Clear invalid tokens
- Preserve user's navigation state

### Data Errors
- Validate response data
- Transform with safe defaults
- Log errors to console
- Show user-friendly messages

## Performance Optimizations

### Caching
- React Query handles automatic caching
- Smart stale times based on data volatility
- Background refetching
- Optimistic updates

### Request Optimization
- Parallel requests where possible
- Debounced search/filter operations
- Conditional fetching (enabled flag)
- Request cancellation on unmount

### Bundle Size
- Tree-shaking with ES modules
- Lazy loading of axios
- Code splitting for auth flows

## Migration Checklist

- [x] Install axios dependency
- [x] Create API client with interceptors
- [x] Implement useLeaderboard hook
- [x] Implement usePlayerStats hook
- [x] Implement useAuth hook
- [x] Update Index.tsx with real API calls
- [x] Add loading states
- [x] Add error handling
- [x] Create .env.example
- [x] Document API integration
- [ ] Add integration tests
- [ ] Update e2e tests
- [ ] Performance testing
- [ ] Security audit

## Next Steps

1. **Backend Integration**:
   - Ensure backend API is running
   - Verify endpoint contracts
   - Test authentication flow

2. **Testing**:
   - Write integration tests for hooks
   - Test error scenarios
   - Verify caching behavior

3. **Monitoring**:
   - Add error tracking (Sentry)
   - Monitor API response times
   - Track user experience metrics

4. **Optimization**:
   - Implement infinite scroll
   - Add request debouncing
   - Optimize bundle size

## Troubleshooting

### API Connection Issues
```typescript
// Check if backend is running
curl http://localhost:3000/api/health

// Verify environment variables
console.log(import.meta.env.VITE_API_BASE_URL);
```

### CORS Errors
- Ensure backend CORS is configured
- Check allowed origins
- Verify credentials flag

### Authentication Issues
- Clear localStorage tokens
- Check token expiration
- Verify JWT secret matches

### Data Loading Issues
- Open React Query DevTools
- Check network tab in browser
- Verify response format matches types

## Resources

- [Axios Documentation](https://axios-http.com/)
- [TanStack Query](https://tanstack.com/query/latest)
- [React Query Best Practices](https://tkdodo.eu/blog/practical-react-query)
- [JWT Best Practices](https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/)

## Support

For issues or questions:
1. Check backend service logs
2. Review browser console for errors
3. Verify environment configuration
4. Check API endpoint availability

---

**Integration Completed**: 2025-10-22
**Backend API**: http://localhost:3000/api
**Frontend Dev Server**: http://localhost:5173
