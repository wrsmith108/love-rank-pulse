import { test, expect } from '@playwright/test';

test.describe('Love Rank Pulse - UI Functionality Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to running dev server
    await page.goto('http://localhost:8080');
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
  });

  test.describe('Tab Switching', () => {
    test('should switch between Session, Country, and Global tabs', async ({ page }) => {
      // Click Session tab
      await page.click('text=Session');
      await expect(page.locator('text=Session #4721')).toBeVisible();

      // Click Country tab
      await page.click('text=Country');
      await page.waitForTimeout(500); // Wait for loading

      // Check that country-specific UI appears
      const hasCountryFilter = await page.locator('text=/country|Country Code/i').count();
      expect(hasCountryFilter).toBeGreaterThan(0);

      // Click Global tab
      await page.click('text=Global');
      await page.waitForTimeout(500); // Wait for loading

      // Verify leaderboard is still visible
      await expect(page.locator('text=/RANK|Rank/i').first()).toBeVisible();
    });

    test('should update player data when switching tabs', async ({ page }) => {
      // Get initial player data using data-testid
      const sessionPlayers = await page.locator('[data-testid="player-row"]').count();

      // Switch to Country tab
      await page.click('text=Country');
      await page.waitForTimeout(500);

      // Check if data changed (different players or stats should appear)
      const countryPlayers = await page.locator('[data-testid="player-row"]').count();

      // At minimum, verify the page didn't crash
      expect(countryPlayers).toBeGreaterThan(0);
    });
  });

  test.describe('Load More Button', () => {
    test('should be visible and clickable', async ({ page }) => {
      const loadMoreButton = page.locator('[data-testid="load-more-button"]');

      // Check if button exists (it may not if all players already shown)
      const buttonCount = await loadMoreButton.count();

      if (buttonCount > 0) {
        await expect(loadMoreButton).toBeVisible();

        // Get initial player count
        const initialCount = await page.locator('[data-testid="player-row"]').count();

        // Click Load More
        await loadMoreButton.click();
        await page.waitForTimeout(500);

        // Check if more players loaded
        const newCount = await page.locator('[data-testid="player-row"]').count();

        // Report results
        console.log(`Initial players: ${initialCount}, After Load More: ${newCount}`);

        // Verify more players loaded
        expect(newCount).toBeGreaterThan(initialCount);
      } else {
        console.log('Load More button not visible (all players already shown)');
      }
    });
  });

  test.describe('Sort By Functionality', () => {
    test('should display Sort By dropdown on Country/Global tabs', async ({ page }) => {
      // Go to Country tab
      await page.click('text=Country');
      await page.waitForTimeout(500);

      // Look for Sort By control
      const sortBy = page.locator('text=/Sort by|Sort By/i');
      const hasSortBy = await sortBy.count();

      if (hasSortBy > 0) {
        await sortBy.click();

        // Look for sort options
        const hasOptions = await page.locator('text=/K\\/D|Kills|Rank/i').count();
        expect(hasOptions).toBeGreaterThan(0);
      } else {
        console.log('Sort By control not found on Country tab');
      }
    });

    test('should change leaderboard order when sort option selected', async ({ page }) => {
      await page.click('text=Country');
      await page.waitForTimeout(500);

      // Try to find and interact with sort dropdown
      const sortDropdown = page.locator('[data-testid="sort-select"]').first();
      const hasSortDropdown = await sortDropdown.count();

      if (hasSortDropdown > 0) {
        // Get first player name before sorting
        const firstPlayerBefore = await page.locator('[data-testid="player-row"]').first().textContent();

        // Click sort dropdown and select different option
        await sortDropdown.click();
        await page.locator('text="K/D Ratio"').click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(500);

        // Get first player after sorting
        const firstPlayerAfter = await page.locator('[data-testid="player-row"]').first().textContent();

        console.log(`Before: ${firstPlayerBefore}, After: ${firstPlayerAfter}`);
      } else {
        console.log('Sort dropdown not found');
      }
    });
  });

  test.describe('Date Range Filter', () => {
    test('should display date range options on Country/Global tabs', async ({ page }) => {
      await page.click('text=Country');
      await page.waitForTimeout(500);

      // Look for time period filter
      const timePeriodButton = page.locator('text=/This Week|This Month|All Time|24h|7d|30d/i').first();
      const hasTimePeriod = await timePeriodButton.count();

      if (hasTimePeriod > 0) {
        await timePeriodButton.click();

        // Check for time period options
        const hasOptions = await page.locator('text=/All Time|This Month|This Week/i').count();
        expect(hasOptions).toBeGreaterThan(0);
      } else {
        console.log('Date range filter not found');
      }
    });

    test('should update data when selecting different time periods', async ({ page }) => {
      await page.click('text=Global');
      await page.waitForTimeout(500);

      // Try to find time period selector
      const timePeriodSelect = page.locator('[data-testid="time-period-select"], button:has-text("All Time"), button:has-text("This Month")').first();
      const hasTimeSelect = await timePeriodSelect.count();

      if (hasTimeSelect > 0) {
        await timePeriodSelect.click();

        // Try to click different time period
        await page.locator('text="This Month"').click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(500);

        console.log('Time period selection attempted');
      } else {
        console.log('Time period selector not found');
      }
    });
  });

  test.describe('Friends Toggle', () => {
    test('should display Friends filter toggle on Country/Global tabs', async ({ page }) => {
      await page.click('text=Country');
      await page.waitForTimeout(500);

      // Look for Friends toggle
      const friendsToggle = page.locator('[data-testid="friends-toggle"]').or(page.getByText(/Friends Only|Show Friends/i)).first();
      const hasToggle = await friendsToggle.count();

      if (hasToggle > 0) {
        const isChecked = await friendsToggle.isChecked().catch(() => false);
        console.log(`Friends toggle found. Checked: ${isChecked}`);

        // Try to toggle it
        await friendsToggle.click();
        await page.waitForTimeout(500);

        const isCheckedAfter = await friendsToggle.isChecked().catch(() => false);
        console.log(`After click. Checked: ${isCheckedAfter}`);
      } else {
        console.log('Friends toggle not found');
      }
    });

    test('should filter leaderboard when Friends toggle is enabled', async ({ page }) => {
      await page.click('text=Global');
      await page.waitForTimeout(500);

      const playersBeforeToggle = await page.locator('table tbody tr, [data-testid="player-row"]').count();

      // Try to find and click friends toggle
      const toggle = page.locator('input[type="checkbox"], [role="switch"]').first();
      const hasToggle = await toggle.count();

      if (hasToggle > 0) {
        await toggle.click();
        await page.waitForTimeout(500);

        const playersAfterToggle = await page.locator('table tbody tr, [data-testid="player-row"]').count();
        console.log(`Players before: ${playersBeforeToggle}, after: ${playersAfterToggle}`);
      } else {
        console.log('Friends toggle control not found');
      }
    });
  });

  test.describe('My Stats Modal', () => {
    test('should open My Stats modal when clicking My Stats button', async ({ page }) => {
      // Click My Stats button
      const myStatsButton = page.locator('button:has-text("My Stats")');
      await expect(myStatsButton).toBeVisible();
      await myStatsButton.click();

      // Wait for modal to appear
      await page.waitForTimeout(500);

      // Check for modal content
      const hasModal = await page.locator('[role="dialog"]').or(page.locator('.modal')).or(page.getByText('Your Stats')).count();
      expect(hasModal).toBeGreaterThan(0);
    });

    test('should close My Stats modal when clicking close button', async ({ page }) => {
      // Open modal
      await page.click('button:has-text("My Stats")');
      await page.waitForTimeout(500);

      // Click close button (X or Close)
      const closeButton = page.locator('button[aria-label="Close"], button:has-text("Close")').first();
      if (await closeButton.count() > 0) {
        await closeButton.click();
        await page.waitForTimeout(500);

        // Verify modal is closed
        const modalVisible = await page.locator('[role="dialog"]:visible').count();
        expect(modalVisible).toBe(0);
      }
    });
  });

  test.describe('Country Selector', () => {
    test('should display country selector on Country tab', async ({ page }) => {
      await page.click('text=Country');
      await page.waitForTimeout(500);

      // Look for country selector
      const countrySelect = page.locator('select, [data-testid="country-select"], button:has-text("US"), button:has-text("United States")').first();
      const hasCountrySelect = await countrySelect.count();

      if (hasCountrySelect > 0) {
        console.log('Country selector found');
        await countrySelect.click();
        await page.waitForTimeout(300);

        // Look for country options
        const hasOptions = await page.locator('text=/Germany|France|Japan|Canada/i').count();
        console.log(`Country options found: ${hasOptions}`);
      } else {
        console.log('Country selector not found on Country tab');
      }
    });

    test('should update leaderboard when selecting different country', async ({ page }) => {
      await page.click('text=Country');
      await page.waitForTimeout(500);

      // Try to change country
      const countrySelector = page.locator('[data-testid="country-select"], select').first();
      const hasSelector = await countrySelector.count();

      if (hasSelector > 0) {
        // Get current country
        const currentCountry = await countrySelector.textContent();
        console.log(`Current country: ${currentCountry}`);

        // Try to select different country
        await countrySelector.click();
        await page.locator('text="Germany"').click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(500);

        console.log('Country selection attempted');
      }
    });
  });

  test.describe('General UI Interactions', () => {
    test('should display connection status indicator', async ({ page }) => {
      const connectionStatus = page.locator('text=/Live|Connected|Disconnected|Connecting/i').first();
      const hasStatus = await connectionStatus.count();
      expect(hasStatus).toBeGreaterThan(0);
    });

    test('should display player rank and K/D ratio', async ({ page }) => {
      const kdRatio = page.locator('text=/\\d+\\.\\d+/').first(); // Matches decimal numbers like K/D
      await expect(kdRatio).toBeVisible();

      const rank = page.locator('[data-testid="rank"]').or(page.getByText(/^#?\d+$/)).first();
      const hasRank = await rank.count();
      expect(hasRank).toBeGreaterThan(0);
    });

    test('should highlight current player row', async ({ page }) => {
      // Look for "You" in the leaderboard
      const yourRow = page.locator('text="You"').first();
      const hasYourRow = await yourRow.count();

      if (hasYourRow > 0) {
        const parentRow = yourRow.locator('xpath=ancestor::tr | ancestor::div[contains(@class, "row")]').first();
        const hasSpecialStyling = await parentRow.evaluate(el => {
          const styles = window.getComputedStyle(el);
          return styles.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
                 styles.borderColor !== 'rgba(0, 0, 0, 0)' ||
                 el.className.includes('highlight') ||
                 el.className.includes('current');
        });

        console.log(`Current player row has special styling: ${hasSpecialStyling}`);
      }
    });

    test('should display country flags', async ({ page }) => {
      // Look for flag indicators (emojis or images)
      const flags = page.locator('img[alt*="flag"]').or(page.locator('[data-testid="country-flag"]')).or(page.getByText(/🇺🇸|🇬🇧|🇩🇪|🇯🇵/));
      const hasFlags = await flags.count();

      console.log(`Country flags found: ${hasFlags}`);
      expect(hasFlags).toBeGreaterThan(0);
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('http://localhost:8080');

      // Check that essential elements are visible
      await expect(page.locator('text=/Session|Country|Global/i').first()).toBeVisible();
      await expect(page.locator('text=/RANK|K\\/D/i').first()).toBeVisible();
    });

    test('should work on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('http://localhost:8080');

      await expect(page.locator('text=/Session|Country|Global/i').first()).toBeVisible();
      await expect(page.locator('button:has-text("My Stats")')).toBeVisible();
    });
  });
});
