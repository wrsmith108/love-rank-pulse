/// <reference types="cypress" />

// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to login a user
       * @example cy.login('user@example.com', 'password123')
       */
      login(email: string, password: string): Chainable<void>;

      /**
       * Custom command to register a new user
       * @example cy.register('John Doe', 'user@example.com', 'password123')
       */
      register(name: string, email: string, password: string): Chainable<void>;

      /**
       * Custom command to logout the current user
       * @example cy.logout()
       */
      logout(): Chainable<void>;

      /**
       * Custom command to wait for WebSocket connection
       * @example cy.waitForWebSocket()
       */
      waitForWebSocket(): Chainable<void>;

      /**
       * Custom command to check if user is authenticated
       * @example cy.isAuthenticated()
       */
      isAuthenticated(): Chainable<boolean>;

      /**
       * Custom command to intercept leaderboard API calls
       * @example cy.interceptLeaderboard('session')
       */
      interceptLeaderboard(type: 'session' | 'country' | 'global', fixture?: string): Chainable<void>;

      /**
       * Custom command to wait for leaderboard to load
       * @example cy.waitForLeaderboard()
       */
      waitForLeaderboard(): Chainable<void>;
    }
  }
}

// Login command
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.visit('/');

  // Open auth modal
  cy.get('[data-testid="login-button"]').click();

  // Fill in login form
  cy.get('input[type="email"]').type(email);
  cy.get('input[type="password"]').type(password);

  // Submit form
  cy.get('button[type="submit"]').contains('Login').click();

  // Wait for auth to complete
  cy.url().should('eq', Cypress.config().baseUrl + '/');
});

// Register command
Cypress.Commands.add('register', (name: string, email: string, password: string) => {
  cy.visit('/');

  // Open auth modal
  cy.get('[data-testid="login-button"]').click();

  // Switch to register view
  cy.contains('Create an account').click();

  // Fill in registration form
  cy.get('input[name="name"]').type(name);
  cy.get('input[type="email"]').type(email);
  cy.get('input[type="password"]').type(password);

  // Submit form
  cy.get('button[type="submit"]').contains('Register').click();

  // Wait for registration to complete
  cy.url().should('eq', Cypress.config().baseUrl + '/');
});

// Logout command
Cypress.Commands.add('logout', () => {
  cy.get('[data-testid="user-menu"]').click();
  cy.get('[data-testid="logout-button"]').click();

  // Verify logout
  cy.get('[data-testid="login-button"]').should('exist');
});

// Wait for WebSocket connection
Cypress.Commands.add('waitForWebSocket', () => {
  cy.get('[data-testid="connection-status"]').should('have.class', 'connected');
});

// Check if user is authenticated
Cypress.Commands.add('isAuthenticated', () => {
  return cy.window().then((win) => {
    return !!win.localStorage.getItem('auth-token');
  });
});

// Intercept leaderboard API calls
Cypress.Commands.add('interceptLeaderboard', (type: 'session' | 'country' | 'global', fixture?: string) => {
  const url = `/api/leaderboard/${type}*`;
  const fixtureFile = fixture || `leaderboard-${type}.json`;

  cy.intercept('GET', url, {
    fixture: fixtureFile
  }).as(`leaderboard-${type}`);
});

// Wait for leaderboard to load
Cypress.Commands.add('waitForLeaderboard', () => {
  cy.get('[data-testid="leaderboard-table"]').should('be.visible');
  cy.get('[data-testid="leaderboard-row"]').should('have.length.greaterThan', 0);
});

export {};
