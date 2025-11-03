import { test, expect } from '@playwright/test';

test.describe('Settings Modal', () => {
  test('should open settings modal when settings button is clicked', async ({ page }) => {
    await page.goto('/');
    
    // Click settings button
    await page.click('#settings-button');
    
    // Check that modal is visible
    const modal = page.locator('#config-modal');
    await expect(modal).toBeVisible();
    
    // Check that modal contains railway selector
    await expect(page.locator('#railway-select')).toBeVisible();
    
    // Check that modal contains station selector
    await expect(page.locator('#station-select')).toBeVisible();
  });

  test('should have prefecture selector in settings modal', async ({ page }) => {
    await page.goto('/');
    
    await page.click('#settings-button');
    
    // Check that prefecture selector exists
    await expect(page.locator('#prefecture-select')).toBeVisible();
  });

  test('should have save and close buttons in settings modal', async ({ page }) => {
    await page.goto('/');
    
    await page.click('#settings-button');
    
    // Check for action buttons
    await expect(page.locator('#save-settings')).toBeVisible();
    await expect(page.locator('#close-modal')).toBeVisible();
    
    // Verify button text
    await expect(page.locator('#save-settings')).toHaveText('適用して再読込');
    await expect(page.locator('#close-modal')).toHaveText('閉じる');
  });

  test('should close settings modal when close button is clicked', async ({ page }) => {
    await page.goto('/');
    
    // Open modal
    await page.click('#settings-button');
    const modal = page.locator('#config-modal');
    await expect(modal).toBeVisible();
    
    // Close modal
    await page.click('#close-modal');
    
    // Modal should be hidden
    await expect(modal).toBeHidden();
  });
});
