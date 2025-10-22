/// <reference types="cypress" />

describe('Leaderboards', () => {
  beforeEach(() => {
    // Set up mock API responses
    cy.intercept('GET', '**/api/leaderboard/session*', {
      fixture: 'leaderboard-session.json'
    }).as('sessionLeaderboard');

    cy.intercept('GET', '**/api/leaderboard/country*', {
      fixture: 'leaderboard-country.json'
    }).as('countryLeaderboard');

    cy.intercept('GET', '**/api/leaderboard/global*', {
      fixture: 'leaderboard-global.json'
    }).as('globalLeaderboard');

    cy.visit('/');
  });

  describe('Session Leaderboard', () => {
    it('should display session leaderboard by default', () => {
      cy.wait('@sessionLeaderboard');

      // Verify session tab is active
      cy.get('[data-testid="tab-session"]').should('have.class', 'active');

      // Verify leaderboard is displayed
      cy.get('[data-testid="leaderboard-table"]').should('be.visible');
      cy.get('[data-testid="leaderboard-row"]').should('have.length.greaterThan', 0);
    });

    it('should display correct player data in session leaderboard', () => {
      cy.wait('@sessionLeaderboard');

      // Verify first player data
      cy.get('[data-testid="leaderboard-row"]').first().within(() => {
        cy.contains('1').should('be.visible'); // Rank
        cy.contains('ProGamer123').should('be.visible'); // Player name
        cy.contains('US').should('be.visible'); // Country code
        cy.contains('3.75').should('be.visible'); // K/D ratio
      });
    });

    it('should show loading skeleton while fetching data', () => {
      // Delay the API response
      cy.intercept('GET', '**/api/leaderboard/session*', {
        fixture: 'leaderboard-session.json',
        delay: 1000
      }).as('slowSessionLeaderboard');

      cy.visit('/');

      // Verify loading skeleton is shown
      cy.get('[data-testid="leaderboard-skeleton"]').should('be.visible');

      cy.wait('@slowSessionLeaderboard');

      // Verify loading skeleton is removed
      cy.get('[data-testid="leaderboard-skeleton"]').should('not.exist');
      cy.get('[data-testid="leaderboard-table"]').should('be.visible');
    });

    it('should display empty state when no players exist', () => {
      cy.intercept('GET', '**/api/leaderboard/session*', {
        statusCode: 200,
        body: {
          success: true,
          data: []
        }
      }).as('emptySessionLeaderboard');

      cy.visit('/');
      cy.wait('@emptySessionLeaderboard');

      // Verify empty state message
      cy.contains('No players yet').should('be.visible');
      cy.contains('Be the first to play').should('be.visible');
    });

    it('should display error state on API failure', () => {
      cy.intercept('GET', '**/api/leaderboard/session*', {
        statusCode: 500,
        body: {
          success: false,
          error: 'Internal server error'
        }
      }).as('failedSessionLeaderboard');

      cy.visit('/');
      cy.wait('@failedSessionLeaderboard');

      // Verify error state
      cy.contains('Failed to load leaderboard').should('be.visible');
      cy.get('[data-testid="retry-button"]').should('be.visible');
    });

    it('should retry loading leaderboard on error', () => {
      // First request fails
      cy.intercept('GET', '**/api/leaderboard/session*', {
        statusCode: 500,
        body: {
          success: false,
          error: 'Internal server error'
        }
      }).as('failedRequest');

      cy.visit('/');
      cy.wait('@failedRequest');

      // Set up successful retry
      cy.intercept('GET', '**/api/leaderboard/session*', {
        fixture: 'leaderboard-session.json'
      }).as('retryRequest');

      // Click retry button
      cy.get('[data-testid="retry-button"]').click();
      cy.wait('@retryRequest');

      // Verify leaderboard is now displayed
      cy.get('[data-testid="leaderboard-table"]').should('be.visible');
    });
  });

  describe('Country Leaderboard', () => {
    it('should display country leaderboard when tab is clicked', () => {
      cy.get('[data-testid="tab-country"]').click();
      cy.wait('@countryLeaderboard');

      // Verify country tab is active
      cy.get('[data-testid="tab-country"]').should('have.class', 'active');

      // Verify leaderboard is displayed
      cy.get('[data-testid="leaderboard-table"]').should('be.visible');
    });

    it('should display only players from selected country', () => {
      cy.get('[data-testid="tab-country"]').click();
      cy.wait('@countryLeaderboard');

      // Verify all players are from US
      cy.get('[data-testid="leaderboard-row"]').each(($row) => {
        cy.wrap($row).contains('US').should('be.visible');
      });
    });

    it('should show country selector in filter bar', () => {
      cy.get('[data-testid="tab-country"]').click();

      // Verify country selector is visible
      cy.get('[data-testid="country-selector"]').should('be.visible');
    });

    it('should update leaderboard when changing country', () => {
      cy.get('[data-testid="tab-country"]').click();
      cy.wait('@countryLeaderboard');

      // Mock different country data
      cy.intercept('GET', '**/api/leaderboard/country*country_code=GB*', {
        statusCode: 200,
        body: {
          success: true,
          data: [
            {
              player_id: 'player-gb-1',
              player_name: 'BritishPlayer',
              country_code: 'GB',
              kills: 40,
              deaths: 15,
              kd_ratio: 2.67,
              is_win: true,
              rank: 1
            }
          ]
        }
      }).as('gbLeaderboard');

      // Change country
      cy.get('[data-testid="country-selector"]').click();
      cy.contains('GB - United Kingdom').click();
      cy.wait('@gbLeaderboard');

      // Verify updated data
      cy.contains('BritishPlayer').should('be.visible');
    });
  });

  describe('Global Leaderboard', () => {
    it('should display global leaderboard when tab is clicked', () => {
      cy.get('[data-testid="tab-global"]').click();
      cy.wait('@globalLeaderboard');

      // Verify global tab is active
      cy.get('[data-testid="tab-global"]').should('have.class', 'active');

      // Verify leaderboard is displayed
      cy.get('[data-testid="leaderboard-table"]').should('be.visible');
    });

    it('should display players from different countries', () => {
      cy.get('[data-testid="tab-global"]').click();
      cy.wait('@globalLeaderboard');

      // Verify players from different countries
      cy.contains('KR').should('be.visible');
      cy.contains('SE').should('be.visible');
      cy.contains('BR').should('be.visible');
    });

    it('should show higher statistics for global players', () => {
      cy.get('[data-testid="tab-global"]').click();
      cy.wait('@globalLeaderboard');

      // Verify first player has high stats
      cy.get('[data-testid="leaderboard-row"]').first().within(() => {
        cy.contains('WorldElite').should('be.visible');
        cy.contains('150').should('be.visible'); // High kills
        cy.contains('7.5').should('be.visible'); // High K/D ratio
      });
    });
  });

  describe('Leaderboard Navigation', () => {
    it('should switch between different leaderboard tabs', () => {
      // Start with session
      cy.wait('@sessionLeaderboard');
      cy.get('[data-testid="tab-session"]').should('have.class', 'active');

      // Switch to country
      cy.get('[data-testid="tab-country"]').click();
      cy.wait('@countryLeaderboard');
      cy.get('[data-testid="tab-country"]').should('have.class', 'active');

      // Switch to global
      cy.get('[data-testid="tab-global"]').click();
      cy.wait('@globalLeaderboard');
      cy.get('[data-testid="tab-global"]').should('have.class', 'active');

      // Switch back to session
      cy.get('[data-testid="tab-session"]').click();
      cy.wait('@sessionLeaderboard');
      cy.get('[data-testid="tab-session"]').should('have.class', 'active');
    });

    it('should preserve scroll position when switching tabs', () => {
      cy.wait('@sessionLeaderboard');

      // Scroll down
      cy.scrollTo(0, 500);

      // Get scroll position
      cy.window().then((win) => {
        const scrollY = win.scrollY;

        // Switch tabs
        cy.get('[data-testid="tab-country"]').click();
        cy.wait('@countryLeaderboard');

        // Switch back
        cy.get('[data-testid="tab-session"]').click();
        cy.wait('@sessionLeaderboard');

        // Verify scroll position is restored (approximately)
        cy.window().its('scrollY').should('be.closeTo', scrollY, 50);
      });
    });
  });

  describe('Mobile Responsiveness', () => {
    beforeEach(() => {
      cy.viewport('iphone-x');
    });

    it('should display mobile-optimized leaderboard', () => {
      cy.wait('@sessionLeaderboard');

      // Verify mobile layout
      cy.get('[data-testid="leaderboard-table"]').should('be.visible');

      // Verify mobile column layout (fewer columns)
      cy.get('[data-testid="leaderboard-row"]').first().within(() => {
        // Mobile should show: Rank, Player, K/D
        cy.contains('1').should('be.visible');
        cy.contains('ProGamer123').should('be.visible');
        cy.contains('3.75').should('be.visible');
      });
    });

    it('should use drawer for filters on mobile', () => {
      cy.wait('@sessionLeaderboard');

      // Click mobile filter button
      cy.get('[data-testid="mobile-filter-button"]').click();

      // Verify drawer is displayed
      cy.get('[data-testid="filter-drawer"]').should('be.visible');
    });
  });
});
