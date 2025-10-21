describe('Authentication', () => {
  beforeEach(() => {
    // Visit the auth test page before each test
    cy.visit('/auth-test');
  });

  it('should allow user registration', () => {
    // Click on the register tab
    cy.contains('Register').click();
    
    // Fill out the registration form
    const username = `testuser_${Date.now()}`;
    const email = `${username}@example.com`;
    const password = 'Password123';
    
    cy.get('input[name="username"]').type(username);
    cy.get('input[name="email"]').type(email);
    cy.get('input[name="password"]').type(password);
    cy.get('input[name="countryCode"]').select('US');
    
    // Submit the form
    cy.get('button[type="submit"]').click();
    
    // Check that registration was successful
    cy.contains('Welcome').should('be.visible');
    cy.contains(username).should('be.visible');
  });

  it('should allow user login', () => {
    // Use test credentials
    const email = 'test@example.com';
    const password = 'password123';
    
    // Fill out the login form
    cy.get('input[name="email"]').type(email);
    cy.get('input[name="password"]').type(password);
    
    // Submit the form
    cy.get('button[type="submit"]').click();
    
    // Check that login was successful
    cy.contains('Welcome back').should('be.visible');
  });

  it('should allow user logout', () => {
    // Login first
    cy.login('test@example.com', 'password123');
    
    // Click logout button
    cy.contains('Logout').click();
    
    // Check that logout was successful
    cy.contains('Login').should('be.visible');
  });

  it('should measure login response time', () => {
    const start = performance.now();
    
    // Login
    cy.get('input[name="email"]').type('test@example.com');
    cy.get('input[name="password"]').type('password123');
    cy.get('button[type="submit"]').click();
    
    // Wait for login to complete
    cy.contains('Welcome back').should('be.visible').then(() => {
      const end = performance.now();
      const responseTime = end - start;
      cy.log(`Login response time: ${responseTime}ms`);
      expect(responseTime).to.be.lessThan(500);
    });
  });
});