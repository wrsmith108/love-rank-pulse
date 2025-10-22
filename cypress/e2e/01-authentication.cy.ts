/// <reference types="cypress" />

describe('Authentication Flow', () => {
  beforeEach(() => {
    // Clear local storage before each test
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  describe('Login', () => {
    it('should display login modal when clicking login button', () => {
      cy.visit('/');
      cy.get('[data-testid="login-button"]').should('be.visible');
      cy.get('[data-testid="login-button"]').click();

      // Verify modal is displayed
      cy.contains('Login').should('be.visible');
      cy.get('input[type="email"]').should('be.visible');
      cy.get('input[type="password"]').should('be.visible');
    });

    it('should show validation errors for empty form', () => {
      cy.visit('/');
      cy.get('[data-testid="login-button"]').click();

      // Try to submit empty form
      cy.get('button[type="submit"]').contains('Login').click();

      // Verify validation errors
      cy.contains('Email is required').should('be.visible');
      cy.contains('Password is required').should('be.visible');
    });

    it('should show validation error for invalid email format', () => {
      cy.visit('/');
      cy.get('[data-testid="login-button"]').click();

      // Enter invalid email
      cy.get('input[type="email"]').type('invalid-email');
      cy.get('input[type="password"]').type('password123');
      cy.get('button[type="submit"]').contains('Login').click();

      // Verify validation error
      cy.contains('Invalid email format').should('be.visible');
    });

    it('should successfully login with valid credentials', () => {
      // Mock successful login API
      cy.intercept('POST', '**/api/auth/login', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            token: 'mock-jwt-token',
            user: {
              id: 'user-1',
              email: 'test@example.com',
              name: 'Test User'
            }
          }
        }
      }).as('loginRequest');

      cy.visit('/');
      cy.get('[data-testid="login-button"]').click();

      // Fill in valid credentials
      cy.get('input[type="email"]').type('test@example.com');
      cy.get('input[type="password"]').type('password123');
      cy.get('button[type="submit"]').contains('Login').click();

      // Wait for login request
      cy.wait('@loginRequest');

      // Verify successful login
      cy.get('[data-testid="user-menu"]').should('be.visible');
      cy.get('[data-testid="login-button"]').should('not.exist');

      // Verify token is stored
      cy.window().its('localStorage.auth-token').should('exist');
    });

    it('should show error message for invalid credentials', () => {
      // Mock failed login API
      cy.intercept('POST', '**/api/auth/login', {
        statusCode: 401,
        body: {
          success: false,
          error: 'Invalid email or password'
        }
      }).as('loginRequest');

      cy.visit('/');
      cy.get('[data-testid="login-button"]').click();

      cy.get('input[type="email"]').type('test@example.com');
      cy.get('input[type="password"]').type('wrongpassword');
      cy.get('button[type="submit"]').contains('Login').click();

      cy.wait('@loginRequest');

      // Verify error message
      cy.contains('Invalid email or password').should('be.visible');
    });

    it('should allow switching to register view', () => {
      cy.visit('/');
      cy.get('[data-testid="login-button"]').click();

      // Click on "Create an account" link
      cy.contains('Create an account').click();

      // Verify register form is displayed
      cy.contains('Create Account').should('be.visible');
      cy.get('input[name="name"]').should('be.visible');
      cy.get('input[type="email"]').should('be.visible');
      cy.get('input[type="password"]').should('be.visible');
    });
  });

  describe('Registration', () => {
    it('should display registration form', () => {
      cy.visit('/');
      cy.get('[data-testid="login-button"]').click();
      cy.contains('Create an account').click();

      // Verify registration form elements
      cy.contains('Create Account').should('be.visible');
      cy.get('input[name="name"]').should('be.visible');
      cy.get('input[type="email"]').should('be.visible');
      cy.get('input[type="password"]').should('be.visible');
      cy.get('button[type="submit"]').contains('Register').should('be.visible');
    });

    it('should show validation errors for empty registration form', () => {
      cy.visit('/');
      cy.get('[data-testid="login-button"]').click();
      cy.contains('Create an account').click();

      // Try to submit empty form
      cy.get('button[type="submit"]').contains('Register').click();

      // Verify validation errors
      cy.contains('Name is required').should('be.visible');
      cy.contains('Email is required').should('be.visible');
      cy.contains('Password is required').should('be.visible');
    });

    it('should validate password strength', () => {
      cy.visit('/');
      cy.get('[data-testid="login-button"]').click();
      cy.contains('Create an account').click();

      // Enter weak password
      cy.get('input[name="name"]').type('Test User');
      cy.get('input[type="email"]').type('test@example.com');
      cy.get('input[type="password"]').type('123');
      cy.get('button[type="submit"]').contains('Register').click();

      // Verify password validation error
      cy.contains('Password must be at least 8 characters').should('be.visible');
    });

    it('should successfully register a new user', () => {
      // Mock successful registration API
      cy.intercept('POST', '**/api/auth/register', {
        statusCode: 201,
        body: {
          success: true,
          data: {
            token: 'mock-jwt-token',
            user: {
              id: 'user-2',
              email: 'newuser@example.com',
              name: 'New User'
            }
          }
        }
      }).as('registerRequest');

      cy.visit('/');
      cy.get('[data-testid="login-button"]').click();
      cy.contains('Create an account').click();

      // Fill in registration form
      cy.get('input[name="name"]').type('New User');
      cy.get('input[type="email"]').type('newuser@example.com');
      cy.get('input[type="password"]').type('securePassword123');
      cy.get('button[type="submit"]').contains('Register').click();

      cy.wait('@registerRequest');

      // Verify successful registration
      cy.get('[data-testid="user-menu"]').should('be.visible');
      cy.window().its('localStorage.auth-token').should('exist');
    });

    it('should show error for duplicate email', () => {
      // Mock duplicate email error
      cy.intercept('POST', '**/api/auth/register', {
        statusCode: 409,
        body: {
          success: false,
          error: 'Email already exists'
        }
      }).as('registerRequest');

      cy.visit('/');
      cy.get('[data-testid="login-button"]').click();
      cy.contains('Create an account').click();

      cy.get('input[name="name"]').type('Test User');
      cy.get('input[type="email"]').type('existing@example.com');
      cy.get('input[type="password"]').type('password123');
      cy.get('button[type="submit"]').contains('Register').click();

      cy.wait('@registerRequest');

      // Verify error message
      cy.contains('Email already exists').should('be.visible');
    });

    it('should allow switching back to login view', () => {
      cy.visit('/');
      cy.get('[data-testid="login-button"]').click();
      cy.contains('Create an account').click();

      // Click on "Already have an account" link
      cy.contains('Already have an account').click();

      // Verify login form is displayed
      cy.contains('Login').should('be.visible');
      cy.get('input[type="email"]').should('be.visible');
      cy.get('input[type="password"]').should('be.visible');
    });
  });

  describe('Logout', () => {
    beforeEach(() => {
      // Mock login to set up authenticated state
      cy.intercept('POST', '**/api/auth/login', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            token: 'mock-jwt-token',
            user: {
              id: 'user-1',
              email: 'test@example.com',
              name: 'Test User'
            }
          }
        }
      }).as('loginRequest');

      cy.visit('/');
      cy.get('[data-testid="login-button"]').click();
      cy.get('input[type="email"]').type('test@example.com');
      cy.get('input[type="password"]').type('password123');
      cy.get('button[type="submit"]').contains('Login').click();
      cy.wait('@loginRequest');
    });

    it('should successfully logout user', () => {
      // Click user menu
      cy.get('[data-testid="user-menu"]').click();

      // Click logout button
      cy.get('[data-testid="logout-button"]').click();

      // Verify logout
      cy.get('[data-testid="login-button"]').should('be.visible');
      cy.get('[data-testid="user-menu"]').should('not.exist');

      // Verify token is removed
      cy.window().its('localStorage.auth-token').should('not.exist');
    });
  });

  describe('Protected Routes', () => {
    it('should redirect unauthenticated users from protected pages', () => {
      cy.visit('/profile');

      // Should be redirected to home with login prompt
      cy.url().should('eq', Cypress.config().baseUrl + '/');
      cy.contains('Login').should('be.visible');
    });

    it('should allow authenticated users to access protected pages', () => {
      // Set up authenticated state
      cy.window().then((win) => {
        win.localStorage.setItem('auth-token', 'mock-jwt-token');
        win.localStorage.setItem('auth-user', JSON.stringify({
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test User'
        }));
      });

      // Mock API to verify token
      cy.intercept('GET', '**/api/auth/me', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            id: 'user-1',
            email: 'test@example.com',
            name: 'Test User'
          }
        }
      });

      cy.visit('/profile');

      // Should stay on profile page
      cy.url().should('include', '/profile');
    });
  });
});
