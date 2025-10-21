// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })

// Custom command for logging in
Cypress.Commands.add('login', (email, password) => {
  cy.visit('/auth-test');
  cy.get('input[name="email"]').type(email);
  cy.get('input[name="password"]').type(password);
  cy.get('button[type="submit"]').click();
  cy.wait(1000); // Wait for login to complete
});

// Custom command for measuring page load time
Cypress.Commands.add('measurePageLoadTime', (url) => {
  const start = performance.now();
  cy.visit(url);
  cy.window().then(() => {
    const end = performance.now();
    const loadTime = end - start;
    cy.log(`Page load time: ${loadTime}ms`);
    return loadTime;
  });
});

// Custom command for measuring API response time
Cypress.Commands.add('measureApiResponseTime', (endpoint) => {
  const start = performance.now();
  cy.request(endpoint).then(() => {
    const end = performance.now();
    const responseTime = end - start;
    cy.log(`API response time for ${endpoint}: ${responseTime}ms`);
    return responseTime;
  });
});

// Custom command for checking leaderboard update latency
Cypress.Commands.add('checkLeaderboardUpdateLatency', () => {
  // This is a placeholder for the actual implementation
  // In a real scenario, we would trigger a match completion and measure
  // how long it takes for the leaderboard to update
  cy.log('Checking leaderboard update latency');
});

// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })