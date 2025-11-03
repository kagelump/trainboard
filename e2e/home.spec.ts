import { test, expect } from '@playwright/test';

test.describe('Trainboard Basic Functionality', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Check that the main header is present
    await expect(page.locator('#station-header')).toBeVisible();
    
    // Check that the time header is present
    await expect(page.locator('#time-header')).toBeVisible();
  });

  test('should display settings button', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Check that settings button exists
    const settingsButton = page.locator('#settings-button');
    await expect(settingsButton).toBeVisible();
    await expect(settingsButton).toHaveAttribute('title', '設定');
  });

  test('should display location button', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Check that location button exists
    const locationButton = page.locator('#location-button');
    await expect(locationButton).toBeVisible();
    await expect(locationButton).toHaveAttribute('title', '現在地から最寄り駅を探す');
  });

  test('should have departure board panels', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Check for both direction panels
    await expect(page.locator('#panel-inbound')).toBeVisible();
    await expect(page.locator('#panel-outbound')).toBeVisible();
    
    // Check for departure containers
    await expect(page.locator('#departures-inbound')).toBeVisible();
    await expect(page.locator('#departures-outbound')).toBeVisible();
  });

  test('should have direction headers', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Check that direction headers exist
    await expect(page.locator('#direction-inbound-header')).toBeVisible();
    await expect(page.locator('#direction-outbound-header')).toBeVisible();
  });
});
