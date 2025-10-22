# Task Execution Plan - Love Rank Pulse

**Generated:** 2025-10-22
**Estimation Method:** T-Shirt Sizing (Token-based)
**Total Estimated Effort:** ~1,400k tokens (~7 Medium tasks)

---

## T-Shirt Sizing Reference

| Size | Token Estimate | Example Task |
|------|----------------|--------------|
| **XS** | 50k tokens | Bug fix, config change, simple implementation |
| **S** | 100k tokens | Feature implementation, small test suite |
| **M** | 200k tokens | Large test suite, complex feature |
| **L** | 400k tokens | Full module implementation |
| **XL** | >400k tokens | **Must be broken down** |

---

## Dependency Graph

```
                    ┌──────────────────┐
                    │  Task 1: Fix TS  │
                    │   Errors (XS)    │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │ Task 2: Player   │
                    │  Stats (S)       │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼─────┐ ┌─────▼──────┐ ┌────▼─────────┐
     │ Task 3: Mock │ │ Task 4A:   │ │ Task 4B:     │
     │  APIs (XS)   │ │ Backend    │ │ WebSocket    │
     └──────────────┘ │ Tests (M)  │ │ Tests (M)    │
                      └─────┬──────┘ └────┬─────────┘
                            │             │
              ┌─────────────┴─────────────┘
              │
     ┌────────▼─────────┐
     │ Task 5A: Auth    │
     │ Component (S)    │
     └────────┬─────────┘
              │
     ┌────────▼─────────┐
     │ Task 5B: UI      │
     │ Components (M)   │
     └────────┬─────────┘
              │
     ┌────────▼─────────┐
     │ Task 6: Hooks    │
     │ Tests (M)        │
     └────────┬─────────┘
              │
     ┌────────▼─────────┐
     │ Task 7A: Service │
     │ Tests (M)        │
     └────────┬─────────┘
              │
     ┌────────▼─────────┐
     │ Task 7B: Integr. │
     │ Tests (S)        │
     └────────┬─────────┘
              │
     ┌────────▼─────────┐
     │ Task 8: Deploy   │
     │ Docs (XS)        │
     └──────────────────┘
```

---

## Execution Waves (Parallel Batches)

### 🌊 Wave 1: Critical Fixes (Sequential)
**Total:** 50k tokens (XS)
**Blocking:** All other work

| Task | Size | Agent | Dependencies |
|------|------|-------|--------------|
| 1. Fix TypeScript Errors | XS | `coder` | None |

**Details:**
- Fix MatchService.ts import and type errors
- Fix sessionManager.ts type guards
- Fix WebSocket URL environment variable
- Verify all tests compile

---

### 🌊 Wave 2: Foundation (Sequential)
**Total:** 100k tokens (S)
**Blocking:** Testing phases

| Task | Size | Agent | Dependencies |
|------|------|-------|--------------|
| 2. Player Statistics | S | `backend-dev` | Wave 1 |
| 3. Mock API Replacement | XS | `coder` | Wave 1 |

**Details:**
- Implement streak calculations
- Implement score aggregations
- Add peakElo/lowestElo tracking
- Replace mock calls with real APIs
- Write unit tests for new code

---

### 🌊 Wave 3: Backend Testing (Parallel)
**Total:** 400k tokens (2×M)
**Blocking:** Frontend testing

| Task | Size | Agent | Dependencies |
|------|------|-------|--------------|
| 4A. API Gateway & Middleware Tests | M | `tester` | Wave 2 |
| 4B. WebSocket & Route Tests | M | `tester` | Wave 2 |

**Details:**
- 45 middleware tests
- 35 server middleware tests
- 40 WebSocket tests
- 35 route handler tests
- Coverage target: 90%+

---

### 🌊 Wave 4: Frontend Testing (Sequential)
**Total:** 300k tokens (S + M)
**Blocking:** Hooks testing

| Task | Size | Agent | Dependencies |
|------|------|-------|--------------|
| 5A. Auth Components Tests | S | `tester` | Wave 3 |
| 5B. UI Components Tests | M | `tester` | Wave 3, 5A |

**Details:**
- 40 auth component tests
- 65 UI component tests
- Coverage target: 80%+
- Accessibility validation

---

### 🌊 Wave 5: Hooks Testing (Sequential)
**Total:** 200k tokens (M)
**Blocking:** Service testing

| Task | Size | Agent | Dependencies |
|------|------|-------|--------------|
| 6. Custom Hooks Tests | M | `tester` | Wave 4 |

**Details:**
- 30 auth & data hook tests
- 20 mutation & WebSocket tests
- 5 utility hook tests
- Coverage target: 85%+

---

### 🌊 Wave 6: Service & Integration (Parallel → Sequential)
**Total:** 300k tokens (M + S)
**Blocking:** Deployment

| Task | Size | Agent | Dependencies |
|------|------|-------|--------------|
| 7A. Service & Edge Case Tests | M | `tester` | Wave 5 |
| 7B. Integration & Performance Tests | S | `tester` | Wave 5, 7A |

**Details:**
- 35 core service tests
- 15 edge case tests
- 15 integration tests
- 10 performance tests
- Coverage target: 90%+ services, 100% critical flows

---

### 🌊 Wave 7: Documentation (Parallel)
**Total:** 50k tokens (XS)
**Blocking:** Nothing

| Task | Size | Agent | Dependencies |
|------|------|-------|--------------|
| 8. Deployment Guide | XS | `documenter` | None (can start anytime) |

**Details:**
- GitHub secrets setup guide
- Railway/Render deployment steps
- Database configuration
- Monitoring setup
- Production checklist

---

## Task Breakdown with Agent Assignments

### Task 1: Fix TypeScript Errors (XS - 50k)
**Agent:** `coder`
**Files:**
- `src/services/MatchService.ts`
- `src/lib/sessionManager.ts`
- `src/hooks/useWebSocketSync.ts`

**Subtasks:**
1. Add Redis client import
2. Fix player1/player2 type unions
3. Add sessionJson type guard
4. Replace hardcoded WebSocket URL
5. Run tests to verify fixes

---

### Task 2: Player Statistics Implementation (S - 100k)
**Agent:** `backend-dev`
**Files:**
- `src/services/PlayerService.ts`
- `prisma/schema.prisma`
- `src/services/__tests__/PlayerService.test.ts`

**Subtasks:**
1. Add peakElo/lowestElo to schema
2. Create migration
3. Implement calculateCurrentStreak()
4. Implement calculateBestStreak()
5. Implement calculateAverageScore()
6. Implement calculateTotalScore()
7. Update stats on match completion
8. Write 10 unit tests
9. Update documentation

---

### Task 3: Replace Mock APIs (XS - 50k)
**Agent:** `coder`
**Files:**
- `src/hooks/useLeaderboardMutations.ts`

**Subtasks:**
1. Implement deleteEntry API call
2. Implement updateEntry API call
3. Implement addEntry API call
4. Implement refreshLeaderboard API call
5. Test CRUD operations

---

### Task 4A: API Gateway & Middleware Tests (M - 200k)
**Agent:** `tester`
**Tests:** 80 tests
**Coverage Target:** 90%+

**Test Files:**
- `src/api-gateway/middleware/__tests__/authMiddleware.test.ts` (7)
- `src/api-gateway/middleware/__tests__/corsMiddleware.test.ts` (5)
- `src/api-gateway/middleware/__tests__/errorMiddleware.test.ts` (5)
- `src/api-gateway/middleware/__tests__/loggingMiddleware.test.ts` (5)
- `src/api-gateway/middleware/__tests__/rateLimitMiddleware.test.ts` (5)
- `src/api-gateway/middleware/__tests__/securityMiddleware.test.ts` (5)
- `src/middleware/__tests__/errorHandler.test.ts` (10)
- `src/middleware/__tests__/logger.test.ts` (8)
- `src/middleware/__tests__/security.test.ts` (9)
- `src/middleware/__tests__/validation.test.ts` (8)
- `src/api-gateway/__tests__/ApiGateway.test.ts` (10)
- `src/api-gateway/routes/__tests__/index.test.ts` (10)

---

### Task 4B: WebSocket & Route Tests (M - 200k)
**Agent:** `tester`
**Tests:** 75 tests
**Coverage Target:** 90%+

**Test Files:**
- `src/websocket/__tests__/server.test.ts` (10)
- `src/websocket/__tests__/connectionManager.test.ts` (10)
- `src/websocket/__tests__/auth.test.ts` (10)
- `src/websocket/events/__tests__/index.test.ts` (10)
- `src/routes/__tests__/health.routes.test.ts` (5)
- `src/routes/__tests__/leaderboard.routes.test.ts` (15)
- `src/routes/__tests__/matches.routes.test.ts` (15)

---

### Task 5A: Auth Component Tests (S - 100k)
**Agent:** `tester`
**Tests:** 40 tests
**Coverage Target:** 80%+

**Test Files:**
- `src/components/__tests__/LoginForm.test.tsx` (10)
- `src/components/__tests__/RegisterForm.test.tsx` (10)
- `src/components/__tests__/AuthModal.test.tsx` (10)
- `src/components/__tests__/ProtectedRoute.test.tsx` (6)
- `src/components/__tests__/AuthTest.test.tsx` (4)

---

### Task 5B: UI Component Tests (M - 200k)
**Agent:** `tester`
**Tests:** 65 tests
**Coverage Target:** 80%+

**Test Files:**
- `src/components/__tests__/Header.test.tsx` (10)
- `src/components/__tests__/FilterBar.test.tsx` (10)
- `src/components/__tests__/LeaderboardTable.test.tsx` (15)
- `src/components/__tests__/LeaderboardRow.test.tsx` (8)
- `src/components/__tests__/MyStatsModal.test.tsx` (10)
- `src/components/__tests__/ConnectionStatus.test.tsx` (6)
- `src/components/__tests__/ErrorBoundary.test.tsx` (6)

---

### Task 6: Custom Hooks Tests (M - 200k)
**Agent:** `tester`
**Tests:** 55 tests
**Coverage Target:** 85%+

**Test Files:**
- `src/hooks/__tests__/useAuth.test.ts` (12)
- `src/hooks/__tests__/useLeaderboard.test.ts` (10)
- `src/hooks/__tests__/usePlayerStats.test.ts` (8)
- `src/hooks/__tests__/useLeaderboardMutations.test.ts` (10)
- `src/hooks/__tests__/useWebSocketSync.test.ts` (10)
- `src/hooks/__tests__/use-toast.test.ts` (5)

---

### Task 7A: Service & Edge Case Tests (M - 200k)
**Agent:** `tester`
**Tests:** 50 tests
**Coverage Target:** 90%+

**Test Files:**
- `src/services/__tests__/database.test.ts` (15)
- `src/services/__tests__/cache.test.ts` (12)
- `src/services/__tests__/healthCheck.test.ts` (8)
- `src/services/__tests__/LeaderboardService.edge.test.ts` (5)
- `src/services/__tests__/MatchService.edge.test.ts` (5)
- `src/services/__tests__/AuthService.edge.test.ts` (5)

---

### Task 7B: Integration & Performance Tests (S - 100k)
**Agent:** `tester`
**Tests:** 25 tests
**Coverage Target:** 100% critical flows

**Test Files:**
- `src/__tests__/integration/UserRegistrationFlow.test.tsx` (5)
- `src/__tests__/integration/LeaderboardRealtimeUpdate.test.tsx` (5)
- `src/__tests__/integration/MatchRecordingFlow.test.tsx` (5)
- `src/__tests__/integration/PerformanceTests.test.ts` (5)
- `src/__tests__/integration/LoadTests.test.ts` (5)

---

### Task 8: Deployment Documentation (XS - 50k)
**Agent:** `documenter`

**Deliverables:**
- GitHub secrets configuration checklist
- Railway deployment step-by-step
- Supabase setup guide
- Upstash Redis configuration
- Environment variable reference
- Health check verification
- Monitoring setup (Sentry)
- Production readiness checklist

---

## Swarm Configuration

### Hierarchical Topology
```
Queen Coordinator (task-orchestrator)
├── Backend Swarm
│   ├── Coder Agent (TypeScript fixes)
│   └── Backend Dev Agent (Player stats)
├── Testing Swarm
│   ├── Backend Tester (Waves 3)
│   ├── Frontend Tester (Waves 4-5)
│   └── Integration Tester (Wave 6)
└── Documentation Agent (Wave 7)
```

### Agent Specializations

**Coder Agent:**
- TypeScript error fixes
- Mock API replacements
- Quick bug fixes

**Backend Dev Agent:**
- Complex business logic
- Database schema changes
- Service implementations

**Tester Agents:**
- Jest test writing
- React Testing Library
- Integration tests
- Performance tests

**Documenter Agent:**
- Deployment guides
- API documentation
- Configuration references

---

## Execution Summary

| Wave | Tasks | Total Size | Parallelization | Est. Tokens |
|------|-------|------------|-----------------|-------------|
| 1 | 1 | XS | Sequential | 50k |
| 2 | 2 | S + XS | Sequential | 150k |
| 3 | 2 | 2×M | **Parallel** | 400k |
| 4 | 2 | S + M | Sequential | 300k |
| 5 | 1 | M | Sequential | 200k |
| 6 | 2 | M + S | Parallel→Seq | 300k |
| 7 | 1 | XS | Parallel | 50k |
| **Total** | **11** | **~1,450k tokens** | **Mixed** | **~7.25 Medium tasks** |

---

## Critical Path

```
Wave 1 (50k) → Wave 2 (150k) → Wave 3 (400k) → Wave 4 (300k) →
Wave 5 (200k) → Wave 6 (300k) → Wave 7 (50k)
```

**Total Critical Path:** ~1,450k tokens
**With Parallelization:** Waves 3 and 6 can run tasks in parallel
**Effective Effort:** ~1,250k tokens

---

## Success Criteria

✅ **Wave 1-2:** All TypeScript errors fixed, build passing
✅ **Wave 3:** Backend coverage ≥90%
✅ **Wave 4-5:** Frontend coverage ≥80%, hooks ≥85%
✅ **Wave 6:** Services ≥90%, critical flows 100%
✅ **Wave 7:** Deployment docs complete
✅ **Overall:** Test coverage ≥85%, CI/CD green

---

**Ready for Swarm Execution!**
