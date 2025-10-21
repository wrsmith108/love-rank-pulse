describe('Homepage', () => {
  beforeEach(() => {
    // Visit the homepage before each test
    cy.visit('/');
  });

  it('should load the homepage successfully', () => {
    // Check that the page has loaded
    cy.get('h1').should('exist');
    cy.get('.container').should('be.visible');
  });

  it('should display the leaderboard table', () => {
    // Check that the leaderboard table is visible
    cy.get('table').should('be.visible');
    cy.get('tbody tr').should('have.length.at.least', 1);
  });

  it('should allow tab navigation', () => {
    // Check that the tabs work
    cy.contains('Country').click();
    cy.url().should('include', 'country');
    
    cy.contains('Global').click();
    cy.url().should('include', 'global');
    
    cy.contains('Session').click();
    cy.url().should('include', 'session');
  });

  it('should measure page load time', () => {
    // Use our custom command to measure page load time
    cy.measurePageLoadTime('/');
  });
});

// Performance test suite
describe('Performance Tests', () => {
  it('should load the homepage within 1 second', () => {
    cy.measurePageLoadTime('/').then((loadTime) => {
      expect(loadTime).to.be.lessThan(1000);
    });
  });

  it('should have API response times under 500ms', () => {
    // Test API endpoints
    cy.measureApiResponseTime('/api/leaderboards/session/current').then((responseTime) => {
      expect(responseTime).to.be.lessThan(500);
    });
    
    cy.measureApiResponseTime('/api/players').then((responseTime) => {
      expect(responseTime).to.be.lessThan(500);
    });
  });
});