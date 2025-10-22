import { test, expect } from '@playwright/test';

test.describe('Production Deployment Debug', () => {
  test('should load homepage and capture console errors', async ({ page }) => {
    const consoleMessages: string[] = [];
    const consoleErrors: string[] = [];
    const networkErrors: string[] = [];

    // Listen for console messages
    page.on('console', msg => {
      const text = `[${msg.type()}] ${msg.text()}`;
      consoleMessages.push(text);
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    // Listen for page errors
    page.on('pageerror', error => {
      consoleErrors.push(`[PAGE ERROR] ${error.message}`);
    });

    // Listen for failed network requests
    page.on('requestfailed', request => {
      networkErrors.push(`[NETWORK FAILED] ${request.url()} - ${request.failure()?.errorText}`);
    });

    // Navigate to the page
    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });

    // Take a screenshot
    await page.screenshot({ path: '/tmp/production-homepage.png', fullPage: true });

    // Check if page is actually black (background color)
    const bgColor = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });

    // Get HTML content
    const htmlContent = await page.content();

    // Check for root element
    const rootElement = await page.$('#root');
    const rootHtml = rootElement ? await rootElement.innerHTML() : 'ROOT NOT FOUND';

    // Print debugging information
    console.log('\n=== DEBUGGING INFO ===');
    console.log(`Background Color: ${bgColor}`);
    console.log(`\nHTML Length: ${htmlContent.length} characters`);
    console.log(`\nRoot Element HTML (first 500 chars):\n${rootHtml.substring(0, 500)}`);
    console.log(`\nConsole Messages (${consoleMessages.length}):`);
    consoleMessages.forEach(msg => console.log(msg));
    console.log(`\nConsole Errors (${consoleErrors.length}):`);
    consoleErrors.forEach(err => console.log(err));
    console.log(`\nNetwork Errors (${networkErrors.length}):`);
    networkErrors.forEach(err => console.log(err));

    // Assertions
    expect(consoleErrors.length).toBe(0);
    expect(networkErrors.length).toBe(0);
    expect(rootHtml).not.toBe('ROOT NOT FOUND');
    expect(rootHtml.length).toBeGreaterThan(0);
  });

  test('should check if JavaScript bundle loads', async ({ page }) => {
    const loadedScripts: string[] = [];
    const failedScripts: string[] = [];

    page.on('response', async response => {
      const url = response.url();
      if (url.includes('.js')) {
        if (response.ok()) {
          loadedScripts.push(url);
        } else {
          failedScripts.push(`${url} - Status: ${response.status()}`);
        }
      }
    });

    await page.goto('/', { waitUntil: 'networkidle' });

    console.log('\n=== JAVASCRIPT BUNDLES ===');
    console.log(`Loaded Scripts (${loadedScripts.length}):`);
    loadedScripts.forEach(script => console.log(script));
    console.log(`\nFailed Scripts (${failedScripts.length}):`);
    failedScripts.forEach(script => console.log(script));

    expect(loadedScripts.length).toBeGreaterThan(0);
    expect(failedScripts.length).toBe(0);
  });

  test('should check API connectivity', async ({ request }) => {
    const healthResponse = await request.get('/api/health');
    const healthData = await healthResponse.json();

    console.log('\n=== API HEALTH CHECK ===');
    console.log(JSON.stringify(healthData, null, 2));

    expect(healthResponse.ok()).toBeTruthy();
    expect(healthData.status).toBe('healthy');
  });
});
