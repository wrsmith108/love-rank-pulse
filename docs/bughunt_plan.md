# Bug Hunt Sprint Plan - Love Rank Pulse UI Functionality

## Sprint Overview
**Goal:** Fix all broken UI interactions and implement missing features identified by E2E tests
**Duration:** 1 sprint
**Test Coverage:** 19 comprehensive E2E tests (currently 13 passing, 6 failing)

---

## 🎯 Sprint Objectives

### Critical (P0) - Must Fix
1. **Make leaderboard testable** - Add data-testid attributes
2. **Fix Load More button** - Currently does nothing
3. **Fix player row rendering detection** - Tests can't find rows

### High Priority (P1) - Should Fix
4. **Implement Sort By dropdown** - Missing on Country/Global tabs
5. **Implement Date Range filter** - Missing time period selection
6. **Implement Friends toggle** - Missing friends filtering

### Medium Priority (P2) - Nice to Have
7. **Fix Playwright test syntax errors** - 4 locator syntax issues
8. **Add proper loading states** - For all async operations

---

## 📋 Detailed Bug List

### Bug #1: Leaderboard Not Testable
**Severity:** P0 - Critical
**Component:** `src/components/LeaderboardTable.tsx`
**Issue:** Uses div-grid layout instead of table elements, no data-testid attributes
**Impact:** E2E tests can't find player rows (returns 0 count)
**Test:** `should update player data when switching tabs` - FAILING

**Fix Required:**
```tsx
// Add to player row wrapper div (line 153)
<div
  key={player.player_id}
  data-testid="player-row"
  data-player-id={player.player_id}
  // ... rest of props
>
```

**Files to Modify:**
- `src/components/LeaderboardTable.tsx` (add data-testid to row wrapper)
- `src/components/LeaderboardRow.tsx` (add data-testid to main div)

---

### Bug #2: Load More Button Non-Functional
**Severity:** P0 - Critical
**Component:** `src/pages/Index.tsx` (line 337-341)
**Issue:** Button exists but onClick does nothing
**Current Code:**
```tsx
<button className="px-6 py-2 bg-secondary hover:bg-secondary/80 ...">
  Load More
</button>
```
**Impact:** Users can't load additional leaderboard entries
**Test:** `should be visible and clickable` - PASSING (button exists) but functionality broken

**Fix Required:**
1. Add state for pagination: `const [displayCount, setDisplayCount] = useState(10)`
2. Slice players array: `players.slice(0, displayCount)`
3. Add onClick handler: `onClick={() => setDisplayCount(prev => prev + 10)}`
4. Hide button when all players loaded: `{displayCount < players.length && ...}`

**Files to Modify:**
- `src/pages/Index.tsx` (add pagination state and handler)

---

### Bug #3: Sort By Dropdown Missing
**Severity:** P1 - High
**Component:** `src/components/FilterBar.tsx`
**Issue:** Feature completely missing from Country/Global tabs
**Impact:** Users can't sort leaderboard by K/D, Kills, Deaths
**Test:** `should display Sort By dropdown on Country/Global tabs` - FAILING
**Console Output:** "Sort dropdown not found"

**Fix Required:**
1. Add `sortBy` prop to FilterBar component
2. Add `onSortChange` callback prop
3. Implement Select component with options:
   - Rank (default)
   - K/D Ratio
   - Kills
   - Deaths
   - Score
4. Add data-testid="sort-select"

**Implementation:**
```tsx
<Select value={sortBy} onValueChange={onSortChange}>
  <SelectTrigger data-testid="sort-select">
    <SelectValue placeholder="Sort by..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="rank">Rank</SelectItem>
    <SelectItem value="kd">K/D Ratio</SelectItem>
    <SelectItem value="kills">Kills</SelectItem>
    <SelectItem value="deaths">Deaths</SelectItem>
  </SelectContent>
</Select>
```

**Files to Modify:**
- `src/components/FilterBar.tsx` (add Sort By select)
- `src/pages/Index.tsx` (wire up sorting logic)

---

### Bug #4: Date Range Filter Missing
**Severity:** P1 - High
**Component:** `src/components/FilterBar.tsx`
**Issue:** Time period filter not implemented
**Impact:** Users can't filter by time range (24h, 7d, 30d, All Time)
**Test:** `should display date range options on Country/Global tabs` - FAILING
**Console Output:** "Date range filter not found", "Time period selector not found"

**Fix Required:**
1. FilterBar already accepts `timePeriod` and `onTimePeriodChange` props
2. Need to implement the UI component (currently missing)
3. Add Select or RadioGroup component
4. Add data-testid="time-period-select"

**Implementation:**
```tsx
<Select value={timePeriod} onValueChange={onTimePeriodChange}>
  <SelectTrigger data-testid="time-period-select">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="24h">Last 24 Hours</SelectItem>
    <SelectItem value="7d">Last 7 Days</SelectItem>
    <SelectItem value="30d">Last 30 Days</SelectItem>
    <SelectItem value="all">All Time</SelectItem>
  </SelectContent>
</Select>
```

**Files to Modify:**
- `src/components/FilterBar.tsx` (add time period UI)
- Check if backend logic exists or needs implementation

---

### Bug #5: Friends Toggle Missing
**Severity:** P1 - High
**Component:** `src/components/FilterBar.tsx`
**Issue:** Friends filtering not implemented
**Impact:** Users can't filter to show only friends
**Test:** `should display Friends filter toggle on Country/Global tabs` - FAILING
**Console Output:** "Friends toggle not found"

**Fix Required:**
1. FilterBar already accepts `showOnlyFriends` and `onToggleFriends` props
2. Need to implement the UI component (currently missing)
3. Add Switch/Checkbox component
4. Add data-testid="friends-toggle"

**Implementation:**
```tsx
<div className="flex items-center gap-2">
  <Switch
    id="friends-toggle"
    checked={showOnlyFriends}
    onCheckedChange={onToggleFriends}
    data-testid="friends-toggle"
  />
  <Label htmlFor="friends-toggle">Friends Only</Label>
</div>
```

**Files to Modify:**
- `src/components/FilterBar.tsx` (add friends toggle UI)
- `src/pages/Index.tsx` (implement friends filtering logic)

---

### Bug #6: Playwright Test Syntax Errors
**Severity:** P2 - Medium
**Component:** `e2e/ui-functionality.spec.ts`
**Issue:** 4 locator syntax errors causing test failures

**Errors:**
1. **Line 168:** Invalid regex flags in `text=/Friends Only|Show Friends/i, [data-testid="friends-toggle"]`
2. **Line 218:** Unexpected token in `[role="dialog"], .modal, text="Your Stats"`
3. **Line 297:** Invalid flags in `text=/^#?\\d+$/, [data-testid="rank"]`
4. **Line 322:** Unexpected token in `img[alt*="flag"], [data-testid="country-flag"], text=/🇺🇸|🇬🇧|🇩🇪|🇯🇵/`

**Fix Required:**
Use proper Playwright locator syntax:
```typescript
// WRONG
page.locator('text=/pattern/i, [data-testid="id"]')

// RIGHT
page.locator('[data-testid="id"]').or(page.locator('text=/pattern/i'))
// OR
page.locator('[data-testid="id"], text=/pattern/i')
```

**Files to Modify:**
- `e2e/ui-functionality.spec.ts` (fix all 4 locator syntax errors)

---

### Bug #7: My Stats Modal Test Failing
**Severity:** P2 - Medium
**Component:** `e2e/ui-functionality.spec.ts`
**Issue:** Test syntax error, but modal appears to work
**Test:** `should open My Stats modal when clicking My Stats button` - FAILING

**Fix Required:**
```typescript
// WRONG (line 218)
const hasModal = await page.locator('[role="dialog"], .modal, text="Your Stats"').count();

// RIGHT
const hasModal = await page.locator('[role="dialog"]').or(page.locator('.modal')).count();
```

**Files to Modify:**
- `e2e/ui-functionality.spec.ts` (fix modal locator)

---

## 🛠️ Implementation Plan

### Phase 1: Critical Fixes (P0)
**Goal:** Make tests pass and fix broken core functionality

1. **Add Testability** (30 min)
   - Add data-testid to LeaderboardTable.tsx
   - Add data-testid to LeaderboardRow.tsx
   - Verify tests can find rows

2. **Implement Load More** (45 min)
   - Add pagination state to Index.tsx
   - Implement slice logic
   - Add onClick handler
   - Hide button when all loaded
   - Test pagination works

### Phase 2: Missing Features (P1)
**Goal:** Implement all missing UI controls

3. **Sort By Dropdown** (60 min)
   - Add Select component to FilterBar
   - Wire up to Index.tsx
   - Implement sorting logic (rank, K/D, kills, deaths)
   - Add data-testid
   - Test sorting changes leaderboard order

4. **Date Range Filter** (45 min)
   - Add Select component to FilterBar
   - Wire up time period filtering
   - Add data-testid
   - Test time range filtering

5. **Friends Toggle** (30 min)
   - Add Switch component to FilterBar
   - Wire up friends filtering logic
   - Add data-testid
   - Test toggle filters players

### Phase 3: Test Fixes (P2)
**Goal:** Clean up test suite

6. **Fix Test Syntax** (30 min)
   - Fix all 4 locator syntax errors
   - Use proper Playwright locator methods
   - Verify all tests use correct syntax

### Phase 4: Verification
**Goal:** Ensure everything works

7. **Run Full E2E Suite** (15 min)
   - Execute all 19 tests
   - Target: 19/19 passing
   - Document any remaining issues

8. **Manual Testing** (30 min)
   - Test all features manually
   - Verify UI/UX is smooth
   - Check mobile responsiveness

---

## 📊 Success Criteria

### Definition of Done
- [ ] All 19 E2E tests passing
- [ ] Load More button loads additional players
- [ ] Sort By dropdown changes leaderboard order
- [ ] Date Range filter works on Country/Global tabs
- [ ] Friends toggle filters player list
- [ ] No console errors
- [ ] Mobile/tablet responsive design maintained
- [ ] All components have proper data-testid attributes
- [ ] Code committed and deployed to production

### Test Coverage Goals
- **Before:** 13/19 tests passing (68%)
- **After:** 19/19 tests passing (100%)

---

## 🔧 Technical Details

### Components Modified
1. `src/components/LeaderboardTable.tsx`
2. `src/components/LeaderboardRow.tsx`
3. `src/components/FilterBar.tsx`
4. `src/pages/Index.tsx`
5. `e2e/ui-functionality.spec.ts`

### New Dependencies
None - all components use existing shadcn/ui library

### Testing Strategy
1. Fix one bug at a time
2. Run E2E test after each fix
3. Verify test passes before moving to next bug
4. Final full E2E suite run at end

---

## 📦 Deliverables

1. **Code Changes**
   - All components updated with fixes
   - All tests passing
   - Clean git history with descriptive commits

2. **Documentation**
   - Updated E2E test findings
   - This bug hunt plan marked as completed
   - Any new issues documented

3. **Deployment**
   - All changes committed to GitHub
   - Production deployed to Vercel
   - Verified working in production

---

## 🚀 Swarm Assignment

### Specialized Agents Needed

1. **Bug Hunter Agent** (Primary)
   - Focus: Find and fix UI bugs
   - Tasks: Implement missing features, fix broken functionality
   - Skills: React, TypeScript, UI/UX

2. **Test Engineer Agent**
   - Focus: Fix and maintain E2E tests
   - Tasks: Fix Playwright syntax errors, verify test coverage
   - Skills: Playwright, E2E testing

3. **Code Reviewer Agent**
   - Focus: Quality assurance
   - Tasks: Review all changes, ensure best practices
   - Skills: Code review, quality standards

4. **Integration Agent**
   - Focus: Wire up components
   - Tasks: Connect filters to data logic, ensure state management works
   - Skills: React state management, component integration

### Swarm Coordination
- **Topology:** Hierarchical (Queen coordinates specialized workers)
- **Strategy:** Sequential with parallel sub-tasks where possible
- **Communication:** Memory-based coordination via hooks
- **Validation:** Each agent runs tests before marking task complete

---

## 📝 Notes

### Known Issues Not in Scope
- Bundle size optimization (warning about 500KB+ chunks)
- WebSocket real-time updates (tested separately)
- Database/API integration (MVP uses mock data)

### Future Enhancements
- Infinite scroll instead of Load More button
- Advanced filtering (by country, date range combined)
- Search player by name
- Export leaderboard to CSV

---

## ✅ Completion Checklist

### Pre-Sprint
- [x] E2E tests created and run
- [x] Bugs identified and documented
- [x] Bug hunt plan created
- [ ] Swarm initialized

### During Sprint
- [ ] All P0 bugs fixed
- [ ] All P1 features implemented
- [ ] All P2 test fixes applied
- [ ] Full E2E suite passing

### Post-Sprint
- [ ] Code reviewed
- [ ] Changes committed
- [ ] Production deployed
- [ ] Sprint retrospective completed

---

**Last Updated:** October 23, 2025
**Status:** Ready for Swarm Execution
**Estimated Completion:** 4-5 hours with specialized swarm
