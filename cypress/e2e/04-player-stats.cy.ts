/// <reference types="cypress" />

describe('Player Stats Modal', () => {
  beforeEach(() => {
    // Mock leaderboard data
    cy.intercept('GET', '**/api/leaderboard/session*', {
      fixture: 'leaderboard-session.json'
    }).as('leaderboard');

    // Mock player stats data
    cy.intercept('GET', '**/api/players/player-1/stats*', {
      fixture: 'player-stats.json'
    }).as('playerStats');

    cy.visit('/');
    cy.wait('@leaderboard');
  });

  describe('Opening Stats Modal', () => {
    it('should open stats modal when clicking on player row', () => {
      // Click on first player row
      cy.get('[data-testid="leaderboard-row"]').first().click();
      cy.wait('@playerStats');

      // Verify modal is displayed
      cy.get('[data-testid="player-stats-modal"]').should('be.visible');
      cy.contains('ProGamer123').should('be.visible');
    });

    it('should open stats modal when clicking on player name', () => {
      cy.contains('ProGamer123').click();
      cy.wait('@playerStats');

      cy.get('[data-testid="player-stats-modal"]').should('be.visible');
    });

    it('should display loading state while fetching stats', () => {
      // Mock slow stats response
      cy.intercept('GET', '**/api/players/player-1/stats*', {
        fixture: 'player-stats.json',
        delay: 1000
      }).as('slowPlayerStats');

      cy.get('[data-testid="leaderboard-row"]').first().click();

      // Verify loading skeleton
      cy.get('[data-testid="stats-loading-skeleton"]').should('be.visible');

      cy.wait('@slowPlayerStats');

      // Verify loading skeleton is removed
      cy.get('[data-testid="stats-loading-skeleton"]').should('not.exist');
    });

    it('should display error state on API failure', () => {
      cy.intercept('GET', '**/api/players/player-1/stats*', {
        statusCode: 500,
        body: {
          success: false,
          error: 'Failed to load player stats'
        }
      }).as('failedPlayerStats');

      cy.get('[data-testid="leaderboard-row"]').first().click();
      cy.wait('@failedPlayerStats');

      // Verify error message
      cy.contains('Failed to load player stats').should('be.visible');
      cy.get('[data-testid="retry-stats-button"]').should('be.visible');
    });
  });

  describe('Stats Display', () => {
    beforeEach(() => {
      cy.get('[data-testid="leaderboard-row"]').first().click();
      cy.wait('@playerStats');
    });

    it('should display player header information', () => {
      cy.get('[data-testid="player-stats-modal"]').within(() => {
        // Verify player name
        cy.contains('ProGamer123').should('be.visible');

        // Verify country
        cy.contains('US').should('be.visible');

        // Verify current rank
        cy.contains('Rank #1').should('be.visible');
      });
    });

    it('should display overall statistics', () => {
      cy.get('[data-testid="stats-overview"]').within(() => {
        // Total matches
        cy.contains('156').should('be.visible');
        cy.contains('Total Matches').should('be.visible');

        // K/D Ratio
        cy.contains('2.39').should('be.visible');
        cy.contains('K/D Ratio').should('be.visible');

        // Win Rate
        cy.contains('57.05%').should('be.visible');
        cy.contains('Win Rate').should('be.visible');

        // Total Kills
        cy.contains('2,340').should('be.visible');
        cy.contains('Total Kills').should('be.visible');
      });
    });

    it('should display detailed statistics', () => {
      cy.get('[data-testid="stats-details"]').within(() => {
        // Headshot percentage
        cy.contains('53.21%').should('be.visible');
        cy.contains('Headshot %').should('be.visible');

        // Accuracy
        cy.contains('65.8%').should('be.visible');
        cy.contains('Accuracy').should('be.visible');

        // Average score
        cy.contains('3,456').should('be.visible');
        cy.contains('Avg Score').should('be.visible');

        // Best killstreak
        cy.contains('15').should('be.visible');
        cy.contains('Best Killstreak').should('be.visible');
      });
    });

    it('should display rank history chart', () => {
      cy.get('[data-testid="rank-history-chart"]').should('be.visible');

      // Verify chart has data points
      cy.get('[data-testid="rank-history-chart"]').find('[data-testid="chart-point"]')
        .should('have.length.greaterThan', 0);
    });

    it('should display performance trend indicator', () => {
      cy.get('[data-testid="performance-trend"]').within(() => {
        cy.contains('improving').should('be.visible');
        cy.get('[data-testid="trend-icon-up"]').should('be.visible');
      });
    });

    it('should display favorite weapon', () => {
      cy.contains('Favorite Weapon').should('be.visible');
      cy.contains('AK-47').should('be.visible');
    });

    it('should display playtime', () => {
      cy.contains('Playtime').should('be.visible');
      cy.contains('234h').should('be.visible');
    });
  });

  describe('Modal Interactions', () => {
    beforeEach(() => {
      cy.get('[data-testid="leaderboard-row"]').first().click();
      cy.wait('@playerStats');
    });

    it('should close modal when clicking close button', () => {
      cy.get('[data-testid="close-modal-button"]').click();

      // Verify modal is closed
      cy.get('[data-testid="player-stats-modal"]').should('not.exist');
    });

    it('should close modal when clicking outside', () => {
      // Click on overlay
      cy.get('[data-testid="modal-overlay"]').click({ force: true });

      // Verify modal is closed
      cy.get('[data-testid="player-stats-modal"]').should('not.exist');
    });

    it('should close modal when pressing Escape key', () => {
      cy.get('body').type('{esc}');

      // Verify modal is closed
      cy.get('[data-testid="player-stats-modal"]').should('not.exist');
    });

    it('should retry loading stats on error', () => {
      // Close current modal
      cy.get('[data-testid="close-modal-button"]').click();

      // Mock failed request
      cy.intercept('GET', '**/api/players/player-1/stats*', {
        statusCode: 500,
        body: {
          success: false,
          error: 'Server error'
        }
      }).as('failedStats');

      cy.get('[data-testid="leaderboard-row"]').first().click();
      cy.wait('@failedStats');

      // Mock successful retry
      cy.intercept('GET', '**/api/players/player-1/stats*', {
        fixture: 'player-stats.json'
      }).as('retryStats');

      // Click retry button
      cy.get('[data-testid="retry-stats-button"]').click();
      cy.wait('@retryStats');

      // Verify stats are displayed
      cy.get('[data-testid="stats-overview"]').should('be.visible');
    });
  });

  describe('My Stats Button', () => {
    beforeEach(() => {
      // Mock authentication
      cy.intercept('POST', '**/api/auth/login', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            token: 'mock-jwt-token',
            user: {
              id: 'player-1',
              email: 'test@example.com',
              name: 'ProGamer123'
            }
          }
        }
      });

      // Login
      cy.visit('/');
      cy.get('[data-testid="login-button"]').click();
      cy.get('input[type="email"]').type('test@example.com');
      cy.get('input[type="password"]').type('password123');
      cy.get('button[type="submit"]').contains('Login').click();
    });

    it('should display "My Stats" button for authenticated users', () => {
      cy.get('[data-testid="my-stats-button"]').should('be.visible');
    });

    it('should open stats modal for current user', () => {
      cy.get('[data-testid="my-stats-button"]').click();
      cy.wait('@playerStats');

      // Verify modal shows current user's stats
      cy.get('[data-testid="player-stats-modal"]').should('be.visible');
      cy.contains('ProGamer123').should('be.visible');
      cy.get('[data-testid="current-user-indicator"]').should('be.visible');
    });

    it('should not display "My Stats" button for unauthenticated users', () => {
      // Logout
      cy.get('[data-testid="user-menu"]').click();
      cy.get('[data-testid="logout-button"]').click();

      // Verify button is not displayed
      cy.get('[data-testid="my-stats-button"]').should('not.exist');
    });
  });

  describe('Mobile Stats Modal', () => {
    beforeEach(() => {
      cy.viewport('iphone-x');
    });

    it('should use drawer for stats on mobile', () => {
      cy.get('[data-testid="leaderboard-row"]').first().click();
      cy.wait('@playerStats');

      // Verify drawer is displayed instead of modal
      cy.get('[data-testid="player-stats-drawer"]').should('be.visible');
    });

    it('should display condensed stats on mobile', () => {
      cy.get('[data-testid="leaderboard-row"]').first().click();
      cy.wait('@playerStats');

      // Verify mobile-optimized layout
      cy.get('[data-testid="stats-mobile-view"]').should('be.visible');

      // Key stats should still be visible
      cy.contains('ProGamer123').should('be.visible');
      cy.contains('2.39').should('be.visible'); // K/D
      cy.contains('57.05%').should('be.visible'); // Win rate
    });

    it('should close drawer by swiping down', () => {
      cy.get('[data-testid="leaderboard-row"]').first().click();
      cy.wait('@playerStats');

      // Simulate swipe down gesture
      cy.get('[data-testid="drawer-handle"]')
        .trigger('touchstart', { touches: [{ clientY: 100 }] })
        .trigger('touchmove', { touches: [{ clientY: 300 }] })
        .trigger('touchend');

      // Verify drawer is closed
      cy.get('[data-testid="player-stats-drawer"]').should('not.be.visible');
    });
  });

  describe('Stats Comparison', () => {
    it('should highlight current user stats in leaderboard', () => {
      // Mock authentication as player-1
      cy.window().then((win) => {
        win.localStorage.setItem('auth-token', 'mock-jwt-token');
        win.localStorage.setItem('current-player-id', 'player-1');
      });

      cy.visit('/');
      cy.wait('@leaderboard');

      // Verify current user row is highlighted
      cy.get('[data-testid="leaderboard-row"]').first()
        .should('have.class', 'current-user');
    });

    it('should display rank change indicator', () => {
      cy.get('[data-testid="leaderboard-row"]').first().click();
      cy.wait('@playerStats');

      // Verify rank change is displayed
      cy.get('[data-testid="rank-change"]').should('be.visible');
    });
  });
});
