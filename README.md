# Love Rank Pulse 🎮⚡

> **Real-time FPS Leaderboard with Live Rankings and Player Statistics**

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF)](https://vitejs.dev/)
[![Live Demo](https://img.shields.io/badge/Demo-Live-success)](https://love-rank-pulse.vercel.app)

A modern, responsive FPS leaderboard application featuring real-time rankings, player statistics, country-based filtering, and comprehensive E2E testing. Built as an MVP with mock data for rapid development and testing.

![Love Rank Pulse Preview](https://love-rank-pulse.vercel.app/og-image.png)

---

## ✨ Features

### 🏆 Core Functionality
- **Real-time Leaderboards** - Session, Country, and Global rankings
- **Player Statistics** - K/D ratios, kills, deaths, win/loss records
- **Country Filtering** - Filter by US, Germany, Japan, UK, France and more
- **Smart Sorting** - Sort by Rank, K/D Ratio, Kills, or Deaths
- **Time Periods** - View stats for different time ranges
- **Friends Filter** - Toggle to show only friends
- **Load More Pagination** - Efficient data loading with 10 players per page
- **My Stats Modal** - Personal statistics and match history

### 🎨 User Experience
- **Responsive Design** - Mobile, tablet, and desktop optimized
- **Dark Theme** - Purple gradient branding with polished UI
- **Country Flags** - Visual country representation with emoji flags
- **Medal Icons** - Gold, silver, bronze for top 3 players
- **Live Indicators** - Real-time connection status
- **Smooth Animations** - Fade-in effects and transitions
- **OpenGraph Images** - Social media preview cards

### 🧪 Testing & Quality
- **19 E2E Tests** - Comprehensive Playwright test coverage (100% passing)
- **Tab Switching Tests** - Session, Country, Global navigation
- **Filter Tests** - Sort, date range, friends toggle validation
- **Modal Tests** - My Stats modal functionality
- **Responsive Tests** - Mobile and tablet viewport testing
- **Country Selector Tests** - Multi-country filtering validation

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ and npm ([install with nvm](https://github.com/nvm-sh/nvm))
- **Git** for version control

### Installation

```bash
# Clone the repository
git clone https://github.com/wrsmith108/love-rank-pulse.git

# Navigate to directory
cd love-rank-pulse

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:8080`

### Available Scripts

```bash
npm run dev              # Start dev server (localhost:8080)
npm run build            # Production build
npm run preview          # Preview production build
npm run lint             # Run ESLint

# Playwright E2E Tests
npx playwright test                           # Run all E2E tests
npx playwright test --ui                      # Run with UI mode
TEST_LOCAL=1 npx playwright test              # Test against localhost

# OpenGraph Image
npm run og:generate      # Regenerate social media preview image
```

---

## 🏗️ Architecture

### Tech Stack

**Frontend:**
- **React 18.3** - UI framework
- **TypeScript 5.8** - Type safety
- **Vite 5.4** - Build tool and dev server
- **Shadcn/UI** - Component library
- **Tailwind CSS 3.4** - Styling
- **Radix UI** - Accessible primitives

**Testing:**
- **Playwright 1.56** - E2E testing
- **Jest 30** - Unit testing (infrastructure ready)
- **React Testing Library** - Component testing

**Development:**
- **ESLint** - Code linting
- **TypeScript ESLint** - TS-specific linting
- **Lovable Tagger** - Development tooling

### Project Structure

```
love-rank-pulse/
├── src/
│   ├── components/          # React components
│   │   ├── ui/             # Shadcn UI components
│   │   ├── FilterBar.tsx   # Country/sort/time filters
│   │   ├── LeaderboardTable.tsx  # Main leaderboard grid
│   │   ├── LeaderboardRow.tsx    # Individual player row
│   │   ├── NavBar.tsx      # Top navigation
│   │   ├── MyStatsModal.tsx      # Player stats modal
│   │   └── TabSwitcher.tsx # Session/Country/Global tabs
│   ├── pages/
│   │   └── Index.tsx       # Main leaderboard page
│   ├── hooks/
│   │   └── use-mobile.ts   # Responsive hook
│   ├── lib/
│   │   └── utils.ts        # Utility functions
│   └── main.tsx            # App entry point
├── e2e/
│   ├── ui-functionality.spec.ts    # Main UI tests (19 tests)
│   └── country-selector.spec.ts    # Country filter tests (4 tests)
├── public/
│   ├── og-image.png        # Social media preview
│   ├── og-image-generator.html    # OG image template
│   └── favicon.svg         # Site icon
├── docs/                   # Comprehensive documentation
├── playwright.config.ts    # Playwright configuration
├── vite.config.ts         # Vite configuration
├── tailwind.config.ts     # Tailwind configuration
└── package.json           # Dependencies and scripts
```

---

## 🎮 Usage Guide

### Tab Navigation

**Session Tab** - Current match rankings
- Shows 11 players from active session (#4721)
- Live connection indicator
- Real-time K/D ratios and stats

**Country Tab** - Country-specific leaderboards
- Filter by country (US, Germany, Japan, UK, France)
- Country-specific rankings
- Searchable country selector

**Global Tab** - Worldwide rankings
- Top 8 global players
- Cross-country competition
- Best of the best

### Filtering & Sorting

**Country Selector** (Country tab only)
- Click globe icon dropdown
- Search by country name or code
- Select from popular countries (US, GB, DE, FR, JP, KR, CA, AU, BR)
- Data updates automatically

**Sort By Dropdown**
- **Rank** - Default ranking order
- **K/D Ratio** - Highest K/D first
- **Kills** - Most kills first
- **Deaths** - Fewest deaths first

**Time Period Filter**
- Current Session
- Last Hour
- Today
- This Week
- This Month
- All Time

**Friends Toggle**
- Switch on to show only friends
- Filter out other players
- Quick friend list view

### Load More Pagination
- Initially shows 10 players
- Click "Load More" to load 10 more
- Shows remaining player count
- Hides when all players loaded

### My Stats Modal
- Click "My Stats" in navigation
- View personal statistics
- See recent match history
- Close with X button

---

## 📊 Mock Data

The current MVP uses comprehensive mock datasets for rapid testing and development:

### Player Distribution
- **Session**: 11 players (current match)
- **Country-specific**:
  - 🇺🇸 US: 5 players
  - 🇩🇪 Germany: 4 players
  - 🇯🇵 Japan: 4 players
  - 🇬🇧 UK: 3 players
  - 🇫🇷 France: 2 players
- **Global**: 8 top worldwide players

### Data Fields
Each player includes:
- `player_id` - Unique identifier
- `player_name` - Display name
- `country_code` - ISO country code
- `kills` - Total kills
- `deaths` - Total deaths
- `kd_ratio` - Kill/Death ratio (calculated)
- `is_win` - Win/Loss status
- `rank` - Position in leaderboard
- `headshots` - (Optional) Headshot count
- `accuracy` - (Optional) Accuracy percentage
- `score` - (Optional) Match score

---

## 🧪 Testing

### E2E Testing with Playwright

**Run All Tests:**
```bash
# Against deployed site
npx playwright test

# Against local dev server
TEST_LOCAL=1 npx playwright test

# With UI mode
npx playwright test --ui

# Specific test file
npx playwright test e2e/country-selector.spec.ts
```

### Test Coverage (23 tests total)

**UI Functionality Tests** (`ui-functionality.spec.ts`) - 19 tests
- ✅ Tab switching (Session, Country, Global)
- ✅ Load More pagination
- ✅ Sort By dropdown functionality
- ✅ Date range filtering
- ✅ Friends toggle
- ✅ My Stats modal open/close
- ✅ Country selector display
- ✅ Connection status indicator
- ✅ Player rank and K/D display
- ✅ Current player highlighting
- ✅ Country flag display
- ✅ Mobile responsiveness (375x667)
- ✅ Tablet responsiveness (768x1024)

**Country Selector Tests** (`country-selector.spec.ts`) - 4 tests
- ✅ Filter Japan players
- ✅ Filter Germany players
- ✅ Different player counts per country
- ✅ Correct country flags displayed

### Test Infrastructure
- **data-testid attributes** - All interactive elements
- **Role-based selectors** - Accessibility-first testing
- **Visual regression ready** - Screenshot capabilities
- **Multi-viewport testing** - Mobile, tablet, desktop

---

## 🚀 Deployment

### Current Deployment
- **Platform**: Vercel
- **URL**: https://love-rank-pulse.vercel.app
- **Auto-deploy**: Enabled on push to `main`
- **HTTPS**: Automatic SSL
- **Preview Deployments**: Enabled for PRs

### Deploy Your Own

**Option 1: Vercel (Recommended)**
1. Fork this repository
2. Sign up at [vercel.com](https://vercel.com)
3. Click "New Project"
4. Import your fork
5. Configure:
   - Framework: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
6. Deploy!

**Option 2: Manual Build**
```bash
npm run build
# Output in dist/ directory
# Deploy dist/ to any static host (Netlify, GitHub Pages, etc.)
```

---

## 🛠️ Development

### Code Style
- **ESLint** configuration with React rules
- **TypeScript strict mode** enabled
- **Prettier-compatible** formatting
- **Component structure**:
  - Functional components with hooks
  - TypeScript interfaces for props
  - Tailwind for styling
  - Shadcn/UI for components

### Adding New Features

1. **Create component** in `src/components/`
2. **Add types** with TypeScript interfaces
3. **Add tests** in `e2e/` directory
4. **Update docs** in relevant markdown files
5. **Test locally** with `npm run dev`
6. **Run E2E tests** with `npx playwright test`
7. **Commit and push** to trigger auto-deploy

### Mock Data Customization

Edit mock data in `src/pages/Index.tsx`:
- `mockSessionPlayers` - Session tab data
- `allCountryPlayers` - Country-specific data
- `mockGlobalPlayers` - Global tab data

---

## 📚 Documentation

Comprehensive docs available in `/docs`:

### Key Documents
- **[MVP Deployment Status](docs/MVP_DEPLOYMENT_STATUS.md)** - Current deployment state
- **[Bug Hunt Plan](docs/bughunt_plan.md)** - UI testing and fixes (COMPLETED)
- **[E2E Test Findings](docs/e2e-test-findings.md)** - Test analysis
- **[Architecture Summary](docs/architecture-summary.md)** - System design
- **[Deployment Guide](docs/DEPLOYMENT_GUIDE.md)** - Production deployment

### Additional Docs
- Database setup guides (for future backend)
- WebSocket integration (for future real-time features)
- API integration guides
- Security reviews
- Performance analysis
- CI/CD setup

---

## 🎨 Design System

### Colors
- **Primary**: Purple gradient (`#8B5CF6` to `#6366F1`)
- **Success**: Green (`#22C55E`)
- **Destructive**: Red (`#EF4444`)
- **Background**: Dark (`#0A0A0F`)
- **Card**: Elevated dark (`#1A1A25`)

### Typography
- **Headings**: Inter font family
- **Body**: System font stack
- **Code**: Monospace

### Spacing
- Consistent 4px grid system
- Tailwind spacing scale

### Components
All components from Shadcn/UI:
- Select, Switch, Label, Input
- Dialog, Popover, Tooltip
- Button, Badge, Separator
- Tabs, Progress, Toast

---

## 🤝 Contributing

Contributions are welcome! This is an open-source project under MIT License.

### How to Contribute
1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new features
5. Run E2E tests (`npx playwright test`)
6. Commit changes (`git commit -m 'Add amazing feature'`)
7. Push to branch (`git push origin feature/amazing-feature`)
8. Open Pull Request

### Contribution Guidelines
- Follow existing code style
- Add TypeScript types for all props
- Include E2E tests for UI changes
- Update documentation as needed
- Keep components under 500 lines
- Use Tailwind for styling

---

## 📝 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

**You are free to:**
- ✅ Use commercially
- ✅ Modify
- ✅ Distribute
- ✅ Private use

**Under the conditions:**
- 📄 License and copyright notice must be included

---

## 🙏 Acknowledgments

- **Shadcn/UI** - Beautiful component library
- **Radix UI** - Accessible primitives
- **Vercel** - Hosting and deployment
- **Playwright** - E2E testing framework
- **Vite** - Lightning-fast build tool
- **React** - UI framework
- **TypeScript** - Type safety

---

## 📞 Support

### Issues & Bugs
- Report issues on [GitHub Issues](https://github.com/wrsmith108/love-rank-pulse/issues)
- Include browser, OS, and steps to reproduce

### Questions & Discussions
- Open a [GitHub Discussion](https://github.com/wrsmith108/love-rank-pulse/discussions)
- Check existing docs in `/docs`

### Contact
- **Repository**: [github.com/wrsmith108/love-rank-pulse](https://github.com/wrsmith108/love-rank-pulse)
- **Live Demo**: [love-rank-pulse.vercel.app](https://love-rank-pulse.vercel.app)

---

## 🗺️ Roadmap

### Current Status (MVP)
- ✅ Core leaderboard functionality
- ✅ Country filtering
- ✅ Sorting and time periods
- ✅ Friends toggle
- ✅ Load More pagination
- ✅ My Stats modal
- ✅ Responsive design
- ✅ E2E testing (100% coverage)
- ✅ OpenGraph social cards
- ✅ Production deployment

### Future Enhancements
- 🔄 Backend API integration
- 🔄 Real-time WebSocket updates
- 🔄 User authentication
- 🔄 Database persistence (PostgreSQL + Prisma ready)
- 🔄 Redis caching layer
- 🔄 Advanced search and filtering
- 🔄 Player profiles
- 🔄 Match history details
- 🔄 Infinite scroll
- 🔄 Export leaderboards (CSV/JSON)
- 🔄 Custom themes
- 🔄 Achievement system

---

## 📊 Project Status

**Version:** 1.0.0 (MVP)
**Status:** ✅ Production
**Last Updated:** October 23, 2025
**Test Coverage:** 23/23 E2E tests passing (100%)
**Deployment:** Vercel (Auto-deploy on push)
**License:** MIT

---

<div align="center">

**Built with ❤️ using React, TypeScript, and Vite**

[Live Demo](https://love-rank-pulse.vercel.app) • [Documentation](docs/) • [Report Bug](https://github.com/wrsmith108/love-rank-pulse/issues) • [Request Feature](https://github.com/wrsmith108/love-rank-pulse/issues)

</div>
