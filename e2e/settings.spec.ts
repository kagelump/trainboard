import { test, expect } from '@playwright/test';

test.describe('Settings Modal', () => {
  test('should open settings modal when settings button is clicked', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Wait for settings button to be ready
    await page.waitForSelector('#settings-button', { state: 'visible' });
    
    // Click settings button
    await page.click('#settings-button');
    
    // Check that modal becomes visible (wait for class change)
    const modal = page.locator('#config-modal');
    await expect(modal).toHaveClass(/flex/);
    
    // Check that modal contains railway selector
    await expect(page.locator('#railway-select')).toBeVisible();
    
    // Check that modal contains station selector
    await expect(page.locator('#station-select')).toBeVisible();
  });

  test('should have prefecture selector in settings modal', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    
    await page.waitForSelector('#settings-button', { state: 'visible' });
    await page.click('#settings-button');
    
    // Wait for modal to be visible
    await page.waitForSelector('#config-modal.flex', { state: 'visible' });
    
    // Check that prefecture selector exists
    await expect(page.locator('#prefecture-select')).toBeVisible();
  });

  test('should have save and close buttons in settings modal', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    
    await page.waitForSelector('#settings-button', { state: 'visible' });
    await page.click('#settings-button');
    
    // Wait for modal to be visible
    await page.waitForSelector('#config-modal.flex', { state: 'visible' });
    
    // Check for action buttons
    await expect(page.locator('#save-settings')).toBeVisible();
    await expect(page.locator('#close-modal')).toBeVisible();
    
    // Verify button text
    await expect(page.locator('#save-settings')).toHaveText('適用して再読込');
    await expect(page.locator('#close-modal')).toHaveText('閉じる');
  });

  test('should close settings modal when close button is clicked', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Open modal
    await page.waitForSelector('#settings-button', { state: 'visible' });
    await page.click('#settings-button');
    
    // Wait for modal to be visible
    const modal = page.locator('#config-modal');
    await page.waitForSelector('#config-modal.flex', { state: 'visible' });
    await expect(modal).toHaveClass(/flex/);
    
    // Close modal
    await page.click('#close-modal');
    
    // Modal should be hidden (wait for class change)
    await expect(modal).toHaveClass(/hidden/);
  });
});
