# Frontend Design Brief for Lovable
## Multiplayer Leaderboard MVP

**Project Type:** Real-time Gaming Leaderboard Dashboard  
**Platform:** Web (Desktop & Mobile Responsive)  
**Framework:** React with TypeScript  
**Styling:** Tailwind CSS  
**Deployment:** Vercel  

---

## 1. Project Overview

### What We're Building
A real-time leaderboard system for a multiplayer shooter game that displays player rankings across three scopes: current match (session), country, and global. Players can track their performance through kills, deaths, and win/loss statistics.

### Core User Flow
1. Player completes a match → Leaderboard updates automatically
2. Player views their ranking across session/country/global scopes
3. Player can always access their personal stats, even if not in top 100
4. Player can filter by time periods to see historical performance

---

## 2. Visual Design System

### 2.1 Design Principles
- **Gaming Aesthetic:** Dark theme with high contrast elements
- **Performance Focused:** K/D ratio and stats are the hero elements
- **Real-time Feel:** Subtle animations for rank changes and updates
- **Mobile-First:** Optimized for quick glances on mobile devices

### 2.2 Color Palette
```css
/* Primary Colors */
--background: #0A0E1B (Deep Navy)
--surface: #141823 (Dark Blue-Gray)
--surface-elevated: #1C2333 (Elevated Surface)

/* Accent Colors */
--accent-primary: #00D4FF (Cyan - for highlights)
--accent-success: #00FF88 (Green - for wins/positive)
--accent-danger: #FF3366 (Red - for losses/negative)
--accent-warning: #FFB800 (Gold - for top 3 ranks)

/* Text Colors */
--text-primary: #FFFFFF (Primary text)
--text-secondary: #94A3B8 (Secondary text)
--text-muted: #64748B (Muted text)

/* Special */
--rank-gold: #FFD700 (1st place)
--rank-silver: #C0C0C0 (2nd place)
--rank-bronze: #CD7F32 (3rd place)
```

### 2.3 Typography
```css
/* Font Stack */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* Type Scale */
--text-xs: 12px;
--text-sm: 14px;
--text-base: 16px;
--text-lg: 18px;
--text-xl: 24px;
--text-2xl: 32px;
--text-3xl: 48px;

/* Font Weights */
--font-regular: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### 2.4 Spacing System
Use Tailwind's default spacing scale (4px base unit):
- `space-1`: 4px
- `space-2`: 8px
- `space-3`: 12px
- `space-4`: 16px
- `space-6`: 24px
- `space-8`: 32px

---

## 3. Component Architecture

### 3.1 Layout Structure
```
App Container
├── Header
│   ├── Logo/Title
│   ├── Tab Navigation (Session | Country | Global)
│   └── My Stats Button (Persistent CTA)
├── Main Content Area
│   ├── Leaderboard View
│   │   ├── Filters Bar (Time period for Country/Global)
│   │   ├── Leaderboard Table/Cards
│   │   └── Load More / Pagination
│   └── Personal Stats Modal/Drawer
└── Footer (Optional - Update timestamp)
```

### 3.2 Core Components

#### Navigation Header
```jsx
<Header>
  <Logo>FPS Leaderboard</Logo>
  <TabGroup>
    <Tab active>Session</Tab>
    <Tab>Country</Tab>
    <Tab>Global</Tab>
  </TabGroup>
  <MyStatsButton>
    <Icon>User</Icon>
    My Stats
  </MyStatsButton>
</Header>
```

**Specs:**
- Sticky header on scroll
- Tab underline animation on active
- My Stats button always visible (primary CTA style)
- Mobile: Tabs become swipeable

#### Leaderboard Table Component
```jsx
<LeaderboardTable>
  <TableHeader>
    <Column>Rank</Column>
    <Column>Player</Column>
    <Column sortable>K/D</Column>
    <Column>Kills</Column>
    <Column>Deaths</Column>
    <Column>W/L</Column>
  </TableHeader>
  <TableBody>
    <Row highlighted={isCurrentPlayer}>
      <Rank special={rank <= 3}>1</Rank>
      <Player>
        <Flag country="US" />
        <Name>Player123</Name>
      </Player>
      <KDRatio positive>3.50</KDRatio>
      <Stat>28</Stat>
      <Stat>8</Stat>
      <WinLoss>W</WinLoss>
    </Row>
  </TableBody>
</LeaderboardTable>
```

**Specs:**
- Top 3 ranks get special medal icons/colors
- Current player row highlighted with accent border
- Positive K/D (>1.0) shown in green, negative in red
- Win = green badge, Loss = red badge
- Mobile: Horizontal scroll with fixed rank column

#### Player Stats Card
```jsx
<StatsCard>
  <PlayerHeader>
    <PlayerName>Player123</PlayerName>
    <CountryBadge>
      <Flag>US</Flag>
      <CountryName>United States</CountryName>
    </CountryBadge>
  </PlayerHeader>
  
  <StatsGrid>
    <StatItem>
      <Label>K/D Ratio</Label>
      <Value highlighted>2.34</Value>
    </StatItem>
    <StatItem>
      <Label>Kills</Label>
      <Value>156</Value>
    </StatItem>
    <StatItem>
      <Label>Deaths</Label>
      <Value>67</Value>
    </StatItem>
    <StatItem>
      <Label>Win Rate</Label>
      <Value>64%</Value>
    </StatItem>
  </StatsGrid>
  
  <RankingSection>
    <RankItem>
      <Scope>Session</Scope>
      <Position>#12 of 100</Position>
    </RankItem>
    <RankItem>
      <Scope>Country</Scope>
      <Position>#234 of 1,847</Position>
    </RankItem>
    <RankItem>
      <Scope>Global</Scope>
      <Position>#1,234 of 10,000</Position>
    </RankItem>
  </RankingSection>
</StatsCard>
```

#### Filter Bar
```jsx
<FilterBar>
  <Label>Time Period:</Label>
  <Select>
    <Option selected>Current Session</Option>
    <Option>Last Hour</Option>
    <Option>Today</Option>
    <Option>All Time</Option>
  </Select>
  <UpdateIndicator>
    <PulsingDot />
    <Text>Live</Text>
  </UpdateIndicator>
</FilterBar>
```

---

## 4. Page Specifications

### 4.1 Session Leaderboard View
**Purpose:** Show results from the most recent match

**Layout:**
- No filter bar (always shows latest match)
- Match ID and timestamp at top
- Top 100 players displayed
- Auto-refresh indicator when new match available
- "Your Position: #X" banner if player not in top 100

**Mobile Adaptations:**
- Compact row height (48px)
- Abbreviated stats (K/D/W only)
- Swipe between tabs

### 4.2 Country Leaderboard View
**Purpose:** Regional rankings with country grouping

**Layout:**
- Filter bar with time period selector
- Country flags next to player names
- Country selector dropdown (optional enhancement)
- Shows only countries with active players
- Aggregated stats from multiple matches

**Special Features:**
- Country distribution chart (optional)
- "Players from X countries" counter

### 4.3 Global Leaderboard View
**Purpose:** Worldwide rankings

**Layout:**
- Filter bar with time period selector
- Mixed country flags showing diversity
- Top 100 global players
- Most prominent stats display

### 4.4 My Stats Modal/Drawer
**Purpose:** Personal statistics dashboard

**Trigger:** "My Stats" button or clicking own name in leaderboard

**Layout (Modal on Desktop, Full Page on Mobile):**
- Large K/D ratio display (hero metric)
- Stats comparison vs average
- Ranking across all three scopes
- Recent match history (last 5)
- Trend indicators (improving/declining)

---

## 5. Interactive Behaviors

### 5.1 Animations & Transitions
```css
/* Rank Changes */
@keyframes rankUp {
  0% { transform: translateY(5px); opacity: 0.7; }
  100% { transform: translateY(0); opacity: 1; }
}

/* New Entry Flash */
@keyframes newEntry {
  0% { background: var(--accent-primary); }
  100% { background: transparent; }
}

/* Loading Skeleton */
.skeleton {
  background: linear-gradient(90deg, 
    var(--surface) 25%, 
    var(--surface-elevated) 50%, 
    var(--surface) 75%);
  animation: shimmer 2s infinite;
}
```

### 5.2 State Management
```typescript
interface LeaderboardState {
  activeTab: 'session' | 'country' | 'global';
  timePeriod: 'session' | 'hour' | 'today' | 'all';
  isLoading: boolean;
  isRefreshing: boolean;
  lastUpdated: Date;
  myStats: PlayerStats | null;
  leaderboardData: LeaderboardEntry[];
}
```

### 5.3 Real-time Updates
- WebSocket connection for live updates (fallback to polling every 5 seconds)
- Visual indicator when new data available
- Smooth transitions for rank changes
- "New Match Available" banner for session tab

---

## 6. Responsive Breakpoints

```css
/* Mobile First Approach */
/* Base: 320px - 639px */
/* SM: 640px - 767px */
/* MD: 768px - 1023px */
/* LG: 1024px - 1279px */
/* XL: 1280px+ */
```

### Mobile Specific (< 768px)
- Single column layout
- Bottom sheet for My Stats
- Swipeable tabs
- Condensed table with horizontal scroll
- Touch-optimized buttons (min 44px height)
- Pull-to-refresh gesture

### Desktop Specific (≥ 768px)
- Multi-column stats display
- Hover states on rows
- Keyboard navigation support
- Side-by-side comparisons
- Floating My Stats modal

---

## 7. Data Structure & API Integration

### 7.1 API Endpoints
```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.example.com';

const endpoints = {
  sessionLeaderboard: `${API_BASE}/api/leaderboards/session`,
  countryLeaderboard: `${API_BASE}/api/leaderboards/country`,
  globalLeaderboard: `${API_BASE}/api/leaderboards/global`,
  playerStats: `${API_BASE}/api/players/{playerId}/stats`,
  matchResults: `${API_BASE}/api/match_results` // POST
};
```

### 7.2 Data Types
```typescript
interface Player {
  player_id: string;
  kills: number;
  deaths: number;
  kd_ratio: number;
  wins: number;
  losses: number;
  win_rate: number;
  country_code: string;
  rank: number;
}

interface LeaderboardResponse {
  data: Player[];
  total_players: number;
  last_updated: string;
  session_id?: string;
}
```

---

## 8. Performance Optimization

### 8.1 Critical Rendering Path
1. Server-side render initial leaderboard data
2. Lazy load country flags
3. Virtual scrolling for large lists
4. Debounce filter changes (300ms)
5. Cache API responses for 5 seconds

### 8.2 Bundle Optimization
```javascript
// Lazy load components
const MyStatsModal = lazy(() => import('./components/MyStatsModal'));
const CountrySelector = lazy(() => import('./components/CountrySelector'));
```

---

## 9. Implementation Checklist for Lovable

### Must Have (MVP)
- [ ] Three tab navigation (Session/Country/Global)
- [ ] Leaderboard table with top 100 players
- [ ] My Stats button and modal/drawer
- [ ] Time period filter for Country/Global views
- [ ] Auto-refresh functionality
- [ ] Mobile responsive design
- [ ] Dark gaming theme
- [ ] Player highlighting in leaderboard
- [ ] Basic loading states

### Nice to Have (Enhancements)
- [ ] Rank change animations
- [ ] Country selector/filter
- [ ] Stats trends/sparklines
- [ ] Comparison with average player
- [ ] Match history in My Stats
- [ ] Sound effects for rank ups
- [ ] Social sharing of stats
- [ ] Keyboard shortcuts

---

## 10. Sample Code Structure for Lovable

```
src/
├── components/
│   ├── Layout/
│   │   ├── Header.tsx
│   │   ├── Navigation.tsx
│   │   └── TabGroup.tsx
│   ├── Leaderboard/
│   │   ├── LeaderboardTable.tsx
│   │   ├── LeaderboardRow.tsx
│   │   ├── FilterBar.tsx
│   │   └── UpdateIndicator.tsx
│   ├── Stats/
│   │   ├── MyStatsButton.tsx
│   │   ├── MyStatsModal.tsx
│   │   ├── StatsCard.tsx
│   │   └── StatItem.tsx
│   └── Common/
│       ├── CountryFlag.tsx
│       ├── RankBadge.tsx
│       └── LoadingState.tsx
├── hooks/
│   ├── useLeaderboard.ts
│   ├── usePlayerStats.ts
│   └── useWebSocket.ts
├── services/
│   ├── api.ts
│   └── websocket.ts
├── types/
│   └── leaderboard.ts
├── utils/
│   ├── formatters.ts
│   └── constants.ts
└── styles/
    └── globals.css
```

---

## 11. Lovable-Specific Instructions

### Prompt Suggestions for Lovable:

1. **Initial Setup:**
"Create a gaming leaderboard dashboard with React and Tailwind CSS. Use a dark theme with cyan (#00D4FF) accents. Include three tabs: Session, Country, and Global."

2. **Component Generation:**
"Build a leaderboard table component that displays rank, player name with country flag, K/D ratio, kills, deaths, and W/L. Highlight top 3 ranks with gold, silver, bronze colors. Make it horizontally scrollable on mobile."

3. **My Stats Feature:**
"Add a 'My Stats' button in the header that opens a modal on desktop and drawer on mobile. Display player's K/D ratio, total stats, and ranking across all three scopes."

4. **Real-time Updates:**
"Implement auto-refresh every 5 seconds with a pulsing indicator. Show a banner when new match data is available."

5. **Responsive Design:**
"Make the layout mobile-first with swipeable tabs on mobile, pull-to-refresh, and condensed table views under 768px width."

### Key Technical Notes for Lovable:
- Use `useState` for local state management
- Implement `useEffect` for polling/WebSocket setup
- Use Tailwind's `dark:` variants for theming
- Add `transition-all duration-200` for smooth animations
- Use `grid` for stats layouts and `flex` for navigation
- Implement virtual scrolling with `react-window` for performance

---

## 12. Deliverables Summary

### What Lovable Should Generate:
1. **Fully responsive leaderboard dashboard** with three view modes
2. **Real-time update mechanism** (polling with WebSocket ready)
3. **Personal stats tracking** accessible from anywhere
4. **Time-based filtering** for historical data
5. **Mobile-optimized experience** with touch gestures
6. **Dark gaming aesthetic** with performance-focused UI

### Success Criteria:
- Loads in under 1 second
- Updates visible within 2 seconds of data change
- Works flawlessly on mobile devices (375px+)
- Zero console errors
- Smooth animations and transitions
- Intuitive without instructions

---

## Sources

*This design brief is based on internal product requirements and standard gaming UI/UX patterns. No external sources were referenced.*