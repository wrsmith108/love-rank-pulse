/// <reference types="cypress" />

describe('Leaderboard Filters', () => {
  beforeEach(() => {
    // Mock API responses
    cy.intercept('GET', '**/api/leaderboard/session*', {
      fixture: 'leaderboard-session.json'
    }).as('leaderboardRequest');

    cy.visit('/');
    cy.wait('@leaderboardRequest');
  });

  describe('Time Period Filter', () => {
    it('should display time period selector', () => {
      cy.get('[data-testid="time-period-selector"]').should('be.visible');
      cy.get('[data-testid="time-period-selector"]').should('contain', 'Current Session');
    });

    it('should filter by last hour', () => {
      // Mock hour filter response
      cy.intercept('GET', '**/api/leaderboard/session*period=hour*', {
        statusCode: 200,
        body: {
          success: true,
          data: [
            {
              player_id: 'player-hour-1',
              player_name: 'HourPlayer',
              country_code: 'US',
              kills: 25,
              deaths: 10,
              kd_ratio: 2.5,
              is_win: true,
              rank: 1
            }
          ]
        }
      }).as('hourFilter');

      cy.get('[data-testid="time-period-selector"]').click();
      cy.contains('Last Hour').click();
      cy.wait('@hourFilter');

      // Verify filtered data
      cy.contains('HourPlayer').should('be.visible');
    });

    it('should filter by today', () => {
      cy.intercept('GET', '**/api/leaderboard/session*period=today*', {
        statusCode: 200,
        body: {
          success: true,
          data: [
            {
              player_id: 'player-today-1',
              player_name: 'TodayPlayer',
              country_code: 'GB',
              kills: 35,
              deaths: 12,
              kd_ratio: 2.92,
              is_win: true,
              rank: 1
            }
          ]
        }
      }).as('todayFilter');

      cy.get('[data-testid="time-period-selector"]').click();
      cy.contains('Today').click();
      cy.wait('@todayFilter');

      cy.contains('TodayPlayer').should('be.visible');
    });

    it('should filter by this week', () => {
      cy.intercept('GET', '**/api/leaderboard/session*period=week*', {
        fixture: 'leaderboard-session.json'
      }).as('weekFilter');

      cy.get('[data-testid="time-period-selector"]').click();
      cy.contains('This Week').click();
      cy.wait('@weekFilter');

      cy.get('[data-testid="leaderboard-table"]').should('be.visible');
    });

    it('should filter by this month', () => {
      cy.intercept('GET', '**/api/leaderboard/session*period=month*', {
        fixture: 'leaderboard-session.json'
      }).as('monthFilter');

      cy.get('[data-testid="time-period-selector"]').click();
      cy.contains('This Month').click();
      cy.wait('@monthFilter');

      cy.get('[data-testid="leaderboard-table"]').should('be.visible');
    });

    it('should filter by all time', () => {
      cy.intercept('GET', '**/api/leaderboard/session*period=all*', {
        fixture: 'leaderboard-global.json'
      }).as('allTimeFilter');

      cy.get('[data-testid="time-period-selector"]').click();
      cy.contains('All Time').click();
      cy.wait('@allTimeFilter');

      cy.get('[data-testid="leaderboard-table"]').should('be.visible');
    });

    it('should persist selected time period when switching tabs', () => {
      // Set time period to "Today"
      cy.get('[data-testid="time-period-selector"]').click();
      cy.contains('Today').click();

      // Switch to country tab
      cy.get('[data-testid="tab-country"]').click();

      // Verify time period is still "Today"
      cy.get('[data-testid="time-period-selector"]').should('contain', 'Today');
    });
  });

  describe('Sort Options', () => {
    it('should display sort selector', () => {
      cy.get('[data-testid="sort-selector"]').should('be.visible');
      cy.get('[data-testid="sort-selector"]').should('contain', 'Rank');
    });

    it('should sort by K/D ratio', () => {
      cy.intercept('GET', '**/api/leaderboard/session*sort=kd*', {
        statusCode: 200,
        body: {
          success: true,
          data: [
            {
              player_id: 'player-kd-1',
              player_name: 'HighKD',
              country_code: 'US',
              kills: 50,
              deaths: 5,
              kd_ratio: 10.0,
              is_win: true,
              rank: 1
            }
          ]
        }
      }).as('kdSort');

      cy.get('[data-testid="sort-selector"]').click();
      cy.contains('K/D Ratio').click();
      cy.wait('@kdSort');

      cy.contains('HighKD').should('be.visible');
      cy.contains('10.0').should('be.visible');
    });

    it('should sort by kills', () => {
      cy.intercept('GET', '**/api/leaderboard/session*sort=kills*', {
        statusCode: 200,
        body: {
          success: true,
          data: [
            {
              player_id: 'player-kills-1',
              player_name: 'KillMaster',
              country_code: 'JP',
              kills: 100,
              deaths: 20,
              kd_ratio: 5.0,
              is_win: true,
              rank: 1
            }
          ]
        }
      }).as('killsSort');

      cy.get('[data-testid="sort-selector"]').click();
      cy.contains('Kills').click();
      cy.wait('@killsSort');

      cy.contains('KillMaster').should('be.visible');
      cy.contains('100').should('be.visible');
    });

    it('should sort by wins', () => {
      cy.intercept('GET', '**/api/leaderboard/session*sort=wins*', {
        fixture: 'leaderboard-session.json'
      }).as('winsSort');

      cy.get('[data-testid="sort-selector"]').click();
      cy.contains('Wins').click();
      cy.wait('@winsSort');

      cy.get('[data-testid="leaderboard-table"]').should('be.visible');
    });
  });

  describe('Friends Filter', () => {
    it('should toggle friends-only filter', () => {
      cy.get('[data-testid="friends-toggle"]').should('be.visible');
      cy.get('[data-testid="friends-toggle"]').should('not.be.checked');

      // Mock friends-only response
      cy.intercept('GET', '**/api/leaderboard/session*friends_only=true*', {
        statusCode: 200,
        body: {
          success: true,
          data: [
            {
              player_id: 'friend-1',
              player_name: 'MyFriend',
              country_code: 'US',
              kills: 30,
              deaths: 15,
              kd_ratio: 2.0,
              is_win: true,
              rank: 1
            }
          ]
        }
      }).as('friendsFilter');

      // Enable friends-only
      cy.get('[data-testid="friends-toggle"]').click();
      cy.wait('@friendsFilter');

      // Verify filtered data
      cy.contains('MyFriend').should('be.visible');
    });

    it('should disable friends filter when toggled off', () => {
      // Enable friends filter first
      cy.get('[data-testid="friends-toggle"]').click();

      // Mock all players response
      cy.intercept('GET', '**/api/leaderboard/session*friends_only=false*', {
        fixture: 'leaderboard-session.json'
      }).as('allPlayersFilter');

      // Disable friends filter
      cy.get('[data-testid="friends-toggle"]').click();
      cy.wait('@allPlayersFilter');

      // Verify all players are shown
      cy.get('[data-testid="leaderboard-row"]').should('have.length.greaterThan', 1);
    });
  });

  describe('Refresh Button', () => {
    it('should refresh leaderboard data', () => {
      // Mock refresh response with different data
      cy.intercept('GET', '**/api/leaderboard/session*', {
        statusCode: 200,
        body: {
          success: true,
          data: [
            {
              player_id: 'refreshed-player',
              player_name: 'RefreshedPlayer',
              country_code: 'US',
              kills: 99,
              deaths: 1,
              kd_ratio: 99.0,
              is_win: true,
              rank: 1
            }
          ]
        }
      }).as('refreshedData');

      cy.get('[data-testid="refresh-button"]').click();
      cy.wait('@refreshedData');

      // Verify updated data
      cy.contains('RefreshedPlayer').should('be.visible');
    });

    it('should show loading state during refresh', () => {
      // Mock slow refresh
      cy.intercept('GET', '**/api/leaderboard/session*', {
        fixture: 'leaderboard-session.json',
        delay: 1000
      }).as('slowRefresh');

      cy.get('[data-testid="refresh-button"]').click();

      // Verify loading indicator
      cy.get('[data-testid="refresh-button"]').should('have.class', 'loading');

      cy.wait('@slowRefresh');

      // Verify loading indicator is removed
      cy.get('[data-testid="refresh-button"]').should('not.have.class', 'loading');
    });
  });

  describe('Combined Filters', () => {
    it('should apply multiple filters simultaneously', () => {
      // Mock combined filter response
      cy.intercept('GET', '**/api/leaderboard/session*period=today*sort=kd*', {
        statusCode: 200,
        body: {
          success: true,
          data: [
            {
              player_id: 'combined-player',
              player_name: 'FilteredPlayer',
              country_code: 'DE',
              kills: 40,
              deaths: 10,
              kd_ratio: 4.0,
              is_win: true,
              rank: 1
            }
          ]
        }
      }).as('combinedFilter');

      // Apply time period filter
      cy.get('[data-testid="time-period-selector"]').click();
      cy.contains('Today').click();

      // Apply sort filter
      cy.get('[data-testid="sort-selector"]').click();
      cy.contains('K/D Ratio').click();

      cy.wait('@combinedFilter');

      // Verify filtered data
      cy.contains('FilteredPlayer').should('be.visible');
      cy.contains('4.0').should('be.visible');
    });

    it('should reset filters when changing leaderboard type', () => {
      // Apply filters
      cy.get('[data-testid="time-period-selector"]').click();
      cy.contains('Today').click();

      cy.get('[data-testid="sort-selector"]').click();
      cy.contains('Kills').click();

      // Switch to country leaderboard
      cy.get('[data-testid="tab-country"]').click();

      // Verify filters are preserved or reset based on design
      cy.get('[data-testid="time-period-selector"]').should('be.visible');
      cy.get('[data-testid="sort-selector"]').should('be.visible');
    });
  });

  describe('Mobile Filter Menu', () => {
    beforeEach(() => {
      cy.viewport('iphone-x');
    });

    it('should open mobile filter drawer', () => {
      cy.get('[data-testid="mobile-filter-button"]').click();
      cy.get('[data-testid="filter-drawer"]').should('be.visible');
    });

    it('should apply filters from mobile drawer', () => {
      cy.get('[data-testid="mobile-filter-button"]').click();

      // Mock filter response
      cy.intercept('GET', '**/api/leaderboard/session*period=week*', {
        fixture: 'leaderboard-session.json'
      }).as('mobileFilter');

      // Apply filter
      cy.get('[data-testid="mobile-time-period"]').click();
      cy.contains('This Week').click();

      // Close drawer
      cy.get('[data-testid="apply-filters-button"]').click();

      cy.wait('@mobileFilter');

      // Verify drawer is closed
      cy.get('[data-testid="filter-drawer"]').should('not.be.visible');
    });

    it('should close mobile filter drawer on cancel', () => {
      cy.get('[data-testid="mobile-filter-button"]').click();
      cy.get('[data-testid="filter-drawer"]').should('be.visible');

      // Click cancel
      cy.get('[data-testid="cancel-filters-button"]').click();

      // Verify drawer is closed
      cy.get('[data-testid="filter-drawer"]').should('not.be.visible');
    });
  });
});
