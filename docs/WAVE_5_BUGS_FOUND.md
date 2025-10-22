# Wave 5: Bugs & Issues Found During Hook Testing

**Testing Phase:** Custom React Hooks
**Date:** October 22, 2025
**Total Bugs Found:** 8

---

## Critical Bugs

### BUG-001: Timer Configuration Incompatible with Testing
**Severity:** 🔴 High
**File:** `/src/hooks/use-toast.ts`
**Line:** 6

**Issue:**
```typescript
const TOAST_REMOVE_DELAY = 1000000; // 1000 seconds!
```

**Problem:**
- Toast notifications never dismiss in tests
- 1000-second delay is unrealistic for UX
- Tests timeout waiting for removal

**Recommendation:**
```typescript
const TOAST_REMOVE_DELAY =
  process.env.NODE_ENV === 'test' ? 1000 : 5000; // 5s in prod, 1s in tests
```

**Impact:** Toast tests fail, user experience with very long delays

---

### BUG-002: Missing Type Property - elo_rating
**Severity:** 🟡 Medium
**File:** `/src/components/LeaderboardTable.tsx` (Player type)

**Issue:**
Tests expect `elo_rating` property but type definition missing:

```typescript
const mockPlayers: Player[] = [
  {
    elo_rating: 2500, // ❌ Type error
    // ... other props
  }
];
```

**Fix Required:**
```typescript
export interface Player {
  player_id: string;
  player_name: string;
  elo_rating: number; // ✅ Add this
  rank: number;
  // ... rest
}
```

**Impact:** Type safety compromised, tests fail compilation

---

### BUG-003: Mutation Context Type Safety
**Severity:** 🟡 Medium
**File:** `/src/hooks/useLeaderboardMutations.ts`
**Line:** 86-87

**Issue:**
```typescript
onError: (err, variables, context) => {
  if (context?.previousData) { // ❌ 'previousData' does not exist on type 'unknown'
    context.previousData.forEach(([queryKey, data]) => {
      queryClient.setQueryData(queryKey, data);
    });
  }
}
```

**Fix Required:**
```typescript
interface MutationContext {
  previousData: Array<[queryKey: unknown[], data: unknown]>;
}

const mutation = useMutation<Response, Error, Params, MutationContext>({
  onError: (err, variables, context) => {
    if (context?.previousData) { // ✅ Now typed correctly
      context.previousData.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
    }
  }
});
```

**Impact:** Runtime errors possible when rollback fails

---

## Medium Severity Bugs

### BUG-004: Missing WebSocket Context Exports
**Severity:** 🟡 Medium
**File:** `/src/contexts/WebSocketContext.tsx`

**Issue:**
```typescript
// In useRealtimeLeaderboard.ts
import { useWebSocketContext, RankChangeEvent } from '@/contexts/WebSocketContext';
// ❌ Module has no exported member 'useWebSocketContext'
```

**Problem:**
- Context exports not matching imports
- Multiple hooks trying to use WebSocketContext
- TypeScript errors prevent coverage collection

**Files Affected:**
- `/src/hooks/useRealtimeLeaderboard.ts`
- `/src/hooks/useLiveMatchEvents.ts`
- `/src/hooks/useWebSocket.ts`

**Fix Required:**
```typescript
// WebSocketContext.tsx
export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within WebSocketProvider');
  }
  return context;
};

export type { RankChangeEvent, LeaderboardUpdateEvent, SubscriptionScope };
```

**Impact:** Hooks unusable, TypeScript compilation errors

---

### BUG-005: import.meta.env Not Available in Jest
**Severity:** 🟡 Medium
**File:** `/src/hooks/useWebSocketSync.ts`
**Line:** 53

**Issue:**
```typescript
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
// ❌ TS1343: The 'import.meta' meta-property is only allowed when...
```

**Problem:**
- Jest doesn't support `import.meta` by default
- Tests can't collect coverage from this file
- Vite-specific syntax not compatible with Jest

**Fix Required:**
```typescript
const getWebSocketUrl = (): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
  }
  return process.env.VITE_WS_URL || 'ws://localhost:3001';
};

const WS_URL = getWebSocketUrl();
```

Or configure Jest:
```javascript
// jest.config.js
transform: {
  '^.+\\.(ts|tsx)$': ['@swc/jest', {
    jsc: {
      parser: {
        syntax: 'typescript',
        tsx: true,
        dynamicImport: true,
        importMeta: true // ✅ Enable import.meta
      }
    }
  }]
}
```

**Impact:** Coverage collection fails, tests incomplete

---

## Low Severity Issues

### BUG-006: Window Focus Refetch Timing
**Severity:** 🟢 Low
**File:** Test implementation
**Test:** TC-HOOK-LB-009

**Issue:**
Window focus event doesn't trigger refetch consistently in tests

**Current Behavior:**
```typescript
act(() => {
  window.dispatchEvent(new Event('blur'));
});

act(() => {
  window.dispatchEvent(new Event('focus'));
});

// ❌ Doesn't trigger refetch immediately
await waitFor(() => {
  expect(mockApiClient.get).toHaveBeenCalledTimes(2);
}, { timeout: 2000 });
```

**Root Cause:**
- React Query has internal debouncing for window focus
- Test QueryClient has `refetchOnWindowFocus: false`
- Focus event timing not aligned with React Query's scheduler

**Fix:**
```typescript
// Use real timers for this test
jest.useRealTimers();

const customQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      staleTime: 0,
      refetchInterval: false
    }
  }
});

// Trigger focus and wait for React Query's internal scheduler
await act(async () => {
  window.dispatchEvent(new Event('focus'));
  await new Promise(resolve => setTimeout(resolve, 150));
});
```

**Impact:** One test fails, feature works in production

---

### BUG-007: Pagination Query Key Mismatch
**Severity:** 🟢 Low
**Test:** TC-HOOK-LB-010

**Issue:**
Pagination test expects `page` property but query doesn't return it

**Test Expectation:**
```typescript
expect(result.current.data?.page).toBe(2);
// ❌ Returns undefined
```

**Actual Response:**
```typescript
const mockResponse = {
  players: [...],
  total: 100,
  page: 1,  // ✅ Present in mock
  limit: 100,
  scope: 'session'
};
```

**Problem:**
React Query cache key doesn't update when `page` param changes with same hook instance

**Fix:**
```typescript
// Option 1: Use useInfiniteQuery for pagination
const { data, fetchNextPage } = useInfiniteQuery({
  queryKey: ['leaderboard', scope],
  queryFn: ({ pageParam = 1 }) => fetchLeaderboard({ ...options, page: pageParam }),
  getNextPageParam: (lastPage) => lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined
});

// Option 2: Force new query key per page
queryKey: ['leaderboard', scope, timePeriod, countryCode, sessionId, page, limit],
```

**Impact:** Pagination UX slightly confusing, test needs adjustment

---

### BUG-008: TOAST_LIMIT Too Restrictive
**Severity:** 🟢 Low
**File:** `/src/hooks/use-toast.ts`
**Line:** 5

**Issue:**
```typescript
const TOAST_LIMIT = 1;
```

**Problem:**
- Only allows 1 toast at a time
- Multiple notifications (success + info) can't stack
- Users might miss important messages

**UX Impact:**
```typescript
toast({ title: 'Friend added' });  // Shows
toast({ title: 'Match starting' }); // Replaces first toast immediately
// User never sees "Friend added"
```

**Recommendation:**
```typescript
const TOAST_LIMIT = 3; // Allow 3 toasts stacked

// Or different limits by variant
const TOAST_LIMITS = {
  destructive: 1, // Only 1 error at a time
  default: 3,     // Up to 3 info toasts
};
```

**Impact:** Users may miss notifications, but prevents toast spam

---

## Summary Statistics

| Severity | Count | Fixed | Remaining |
|----------|-------|-------|-----------|
| 🔴 Critical | 1 | 0 | 1 |
| 🟡 Medium | 4 | 1 | 3 |
| 🟢 Low | 3 | 0 | 3 |
| **Total** | **8** | **1** | **7** |

---

## Priority Fix Order

### Sprint 1 (Immediate)
1. **BUG-001:** Timer configuration (blocks tests)
2. **BUG-002:** Type safety for elo_rating
3. **BUG-003:** Mutation context typing

### Sprint 2 (This Week)
4. **BUG-004:** WebSocket context exports
5. **BUG-005:** import.meta.env handling

### Sprint 3 (Nice to Have)
6. **BUG-006:** Window focus refetch timing
7. **BUG-007:** Pagination query key
8. **BUG-008:** Toast limit configuration

---

## Test Coverage Impact

### Before Fixes
- **useAuth:** 0% (JSX syntax issue - FIXED)
- **useLeaderboard:** 90.6%
- **usePlayerStats:** 95.2%
- **useLeaderboardMutations:** Cannot collect (type errors)
- **useWebSocketSync:** Cannot collect (import.meta)
- **use-toast:** 0% (timer issue)

### After Recommended Fixes
- **useAuth:** ~85% (full test coverage)
- **useLeaderboard:** 95%+
- **usePlayerStats:** 95%+ (unchanged)
- **useLeaderboardMutations:** ~80%
- **useWebSocketSync:** ~85%
- **use-toast:** ~75%

**Estimated Overall Coverage:** **85%+** (exceeds 85% target)

---

## Code Quality Recommendations

### 1. Environment Variable Handling Pattern

```typescript
// utils/env.ts
export const getEnvVar = (key: string, defaultValue: string): string => {
  // Vite/Browser
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key] || defaultValue;
  }
  // Node/Jest
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || defaultValue;
  }
  return defaultValue;
};

// Usage
const WS_URL = getEnvVar('VITE_WS_URL', 'ws://localhost:3001');
```

### 2. Configuration Factory Pattern

```typescript
// config/toast.ts
export interface ToastConfig {
  limit: number;
  removeDelay: number;
  position: 'top' | 'bottom';
}

export const createToastConfig = (env: 'development' | 'production' | 'test'): ToastConfig => ({
  limit: env === 'test' ? 1 : 3,
  removeDelay: env === 'test' ? 1000 : 5000,
  position: 'bottom'
});

const config = createToastConfig(process.env.NODE_ENV as any);
```

### 3. Type-Safe Mutation Context

```typescript
// types/mutations.ts
export interface OptimisticUpdateContext<T = unknown> {
  previousData: Array<[queryKey: unknown[], data: T]>;
  timestamp: number;
}

export const createMutationWithRollback = <TData, TError, TVariables>(
  mutationFn: (vars: TVariables) => Promise<TData>,
  optimisticUpdate: (vars: TVariables) => void
) => {
  return useMutation<TData, TError, TVariables, OptimisticUpdateContext>({
    mutationFn,
    onMutate: (vars) => {
      const previousData = captureCurrentState();
      optimisticUpdate(vars);
      return { previousData, timestamp: Date.now() };
    },
    onError: (err, vars, context) => {
      if (context?.previousData) {
        rollbackToState(context.previousData);
      }
    }
  });
};
```

---

## Testing Improvements Implemented

### ✅ Fixed Issues

1. **Test File Extensions**
   - Changed from `.test.ts` to `.test.tsx`
   - Enables JSX syntax in tests
   - All 6 files renamed successfully

2. **React Query Test Utilities**
   - Created `createTestQueryClient()` factory
   - Configured for deterministic testing
   - No retries, no caching, immediate GC

3. **WebSocket Mocking**
   - Full MockWebSocket class implementation
   - Event simulation methods
   - Connection state management

4. **Timer Management**
   - Proper `jest.useFakeTimers()` setup
   - `jest.advanceTimersByTime()` for controlled timing
   - Cleanup in `afterEach()`

---

**Report Completed:** October 22, 2025
**Bugs Logged:** 8 total (1 critical, 4 medium, 3 low)
**Fix Priority:** Sprint 1 = 3 bugs, Sprint 2 = 2 bugs, Sprint 3 = 3 bugs
