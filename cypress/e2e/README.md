# E2E Test Suite Documentation

## Overview

This directory contains comprehensive end-to-end tests for the Love Rank Pulse application using Cypress. The tests cover all critical user flows and ensure the application works correctly from a user's perspective.

## Test Structure

### 01-authentication.cy.ts
**User Authentication Flow**
- Login functionality with validation
- Registration with error handling
- Logout functionality
- Protected route access control
- Password strength validation
- Email format validation
- Duplicate email handling

### 02-leaderboards.cy.ts
**Leaderboard Display and Navigation**
- Session leaderboard display
- Country leaderboard filtering
- Global leaderboard display
- Loading states and skeletons
- Empty states
- Error handling and retry
- Tab navigation
- Mobile responsive layout

### 03-filters.cy.ts
**Leaderboard Filtering**
- Time period filters (session, hour, today, week, month, all-time)
- Sort options (rank, K/D, kills, wins)
- Friends-only filter
- Country selection
- Combined filters
- Refresh functionality
- Mobile filter drawer

### 04-player-stats.cy.ts
**Player Statistics Modal**
- Opening stats modal
- Loading states
- Error handling
- Display of overall statistics
- Detailed stats display
- Rank history chart
- Performance trends
- "My Stats" functionality
- Mobile drawer view

### 05-realtime-updates.cy.ts
**Real-time WebSocket Updates**
- WebSocket connection establishment
- Connection status indicators
- Live player data updates
- Rank change animations
- Player addition/removal
- Update notifications
- Offline/online handling
- Update throttling
- Performance with high-frequency updates

## Running Tests

### Run all E2E tests
```bash
npm run test:e2e
```

### Run tests in interactive mode
```bash
npm run test:e2e:open
```

### Run specific test file
```bash
npx cypress run --spec "cypress/e2e/01-authentication.cy.ts"
```

### Run tests in specific browser
```bash
npx cypress run --browser chrome
npx cypress run --browser firefox
npx cypress run --browser edge
```

### Run tests with different viewport sizes
```bash
# Mobile
npx cypress run --config viewportWidth=375,viewportHeight=667

# Tablet
npx cypress run --config viewportWidth=768,viewportHeight=1024

# Desktop
npx cypress run --config viewportWidth=1920,viewportHeight=1080
```

## Test Fixtures

Test fixtures are located in `/workspaces/love-rank-pulse/cypress/fixtures/`:

- `leaderboard-session.json` - Mock data for session leaderboard
- `leaderboard-country.json` - Mock data for country leaderboard
- `leaderboard-global.json` - Mock data for global leaderboard
- `player-stats.json` - Mock data for player statistics

## Custom Commands

Custom Cypress commands are defined in `/workspaces/love-rank-pulse/cypress/support/commands.ts`:

- `cy.login(email, password)` - Login a user
- `cy.register(name, email, password)` - Register a new user
- `cy.logout()` - Logout current user
- `cy.waitForWebSocket()` - Wait for WebSocket connection
- `cy.isAuthenticated()` - Check authentication status
- `cy.interceptLeaderboard(type, fixture)` - Intercept leaderboard API calls
- `cy.waitForLeaderboard()` - Wait for leaderboard to load

## Best Practices

1. **Use data-testid attributes** - Always use `data-testid` for selecting elements
2. **Mock API calls** - Use `cy.intercept()` to mock backend responses
3. **Wait for async operations** - Always wait for API calls and WebSocket events
4. **Test isolation** - Each test should be independent and clean up after itself
5. **Descriptive test names** - Use clear, descriptive test names
6. **Page object pattern** - Consider using page objects for complex pages
7. **Mobile testing** - Test mobile responsiveness with different viewports

## CI/CD Integration

These tests are designed to run in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run E2E tests
  run: npm run test:e2e

- name: Upload test artifacts
  if: failure()
  uses: actions/upload-artifact@v3
  with:
    name: cypress-screenshots
    path: cypress/screenshots
```

## Debugging

### Record test runs
```bash
npx cypress run --record --key <record-key>
```

### Debug specific test
```bash
npx cypress open --config watchForFileChanges=true
```

### Enable debug logs
```bash
DEBUG=cypress:* npx cypress run
```

## Coverage

The E2E test suite covers:
- ✅ User authentication (login, register, logout)
- ✅ Leaderboard display (session, country, global)
- ✅ Filtering and sorting
- ✅ Player statistics modal
- ✅ Real-time WebSocket updates
- ✅ Error handling and retry logic
- ✅ Loading states and skeletons
- ✅ Empty states
- ✅ Mobile responsiveness
- ✅ Offline/online handling

## Maintenance

1. Update fixtures when API schemas change
2. Add new tests for new features
3. Keep custom commands DRY and reusable
4. Review and update test data regularly
5. Monitor test execution times and optimize slow tests

## Contact

For questions or issues with the E2E tests, please contact the testing team or create an issue in the repository.
