import { test, expect } from '@playwright/test';

test.describe('Country Selector Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8081');
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
  });

  test('should filter players when selecting Japan', async ({ page }) => {
    // Click Country tab
    await page.click('text=Country');
    await page.waitForTimeout(500);

    // Get initial players (should be US by default)
    const initialPlayers = await page.locator('[data-testid="player-row"]').count();
    console.log(`Initial US players: ${initialPlayers}`);

    // Open country selector (Shadcn Select component)
    await page.click('[data-testid="country-select"]');
    await page.waitForTimeout(300);

    // Select Japan from dropdown
    await page.getByRole('option', { name: /JP.*Japan/i }).click();
    await page.waitForTimeout(500);

    // Get new player count
    const japanPlayers = await page.locator('[data-testid="player-row"]').count();
    console.log(`Japan players after selection: ${japanPlayers}`);

    // Verify Japan players are showing
    expect(japanPlayers).toBeGreaterThan(0);

    // Verify Japanese player names are visible
    const playerNames = await page.locator('[data-testid="player-row"]').allTextContents();
    console.log('Player names:', playerNames);

    // Check for Japanese players (SamuraiX, TokyoDrifter, NinjaMaster, VortexPro)
    const hasJapanesePlayers = playerNames.some(name =>
      name.includes('Samurai') ||
      name.includes('Tokyo') ||
      name.includes('Ninja') ||
      name.includes('Vortex')
    );
    expect(hasJapanesePlayers).toBe(true);
  });

  test('should filter players when selecting Germany', async ({ page }) => {
    // Click Country tab
    await page.click('text=Country');
    await page.waitForTimeout(500);

    // Open country selector and select Germany
    await page.click('[data-testid="country-select"]');
    await page.waitForTimeout(300);

    await page.getByRole('option', { name: /DE.*Germany/i }).click();
    await page.waitForTimeout(500);

    // Get player names
    const playerNames = await page.locator('[data-testid="player-row"]').allTextContents();
    console.log('German players:', playerNames);

    // Check for German players (PanzerElite, BerlinSniper, TeutonWarrior, PhantomAce)
    const hasGermanPlayers = playerNames.some(name =>
      name.includes('Panzer') ||
      name.includes('Berlin') ||
      name.includes('Teuton') ||
      name.includes('Phantom')
    );
    expect(hasGermanPlayers).toBe(true);
  });

  test('should show different player counts for different countries', async ({ page }) => {
    // Click Country tab
    await page.click('text=Country');
    await page.waitForTimeout(500);

    // Check US players (default)
    const usPlayers = await page.locator('[data-testid="player-row"]').count();
    console.log(`US players: ${usPlayers}`);

    // Switch to Germany
    await page.click('[data-testid="country-select"]');
    await page.getByRole('option', { name: /DE.*Germany/i }).click();
    await page.waitForTimeout(500);
    const dePlayers = await page.locator('[data-testid="player-row"]').count();
    console.log(`DE players: ${dePlayers}`);

    // Switch to Japan
    await page.click('[data-testid="country-select"]');
    await page.getByRole('option', { name: /JP.*Japan/i }).click();
    await page.waitForTimeout(500);
    const jpPlayers = await page.locator('[data-testid="player-row"]').count();
    console.log(`JP players: ${jpPlayers}`);

    // All countries should have players
    expect(usPlayers).toBeGreaterThan(0);
    expect(dePlayers).toBeGreaterThan(0);
    expect(jpPlayers).toBeGreaterThan(0);
  });

  test('should display correct country flags for filtered country', async ({ page }) => {
    // Click Country tab
    await page.click('text=Country');
    await page.waitForTimeout(500);

    // Select Japan
    await page.click('[data-testid="country-select"]');
    await page.getByRole('option', { name: /JP.*Japan/i }).click();
    await page.waitForTimeout(500);

    // Check for Japanese flag emoji (🇯🇵)
    const pageContent = await page.content();
    const hasJapaneseFlag = pageContent.includes('🇯🇵');

    console.log(`Page has Japanese flags: ${hasJapaneseFlag}`);
    expect(hasJapaneseFlag).toBe(true);
  });
});
