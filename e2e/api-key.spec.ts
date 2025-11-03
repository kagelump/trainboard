import { test, expect } from '@playwright/test';

test.describe('API Key Modal', () => {
  test('should have API key modal in the DOM', async ({ page }) => {
    await page.goto('/');
    
    // Check that API key modal exists (even if not initially visible)
    const modal = page.locator('#api-key-modal');
    await expect(modal).toBeAttached();
  });

  test('should have API key input field', async ({ page }) => {
    await page.goto('/');
    
    // Check for API key input
    await expect(page.locator('#api-key-input')).toBeAttached();
  });

  test('should have save and close buttons in API key modal', async ({ page }) => {
    await page.goto('/');
    
    // Check for action buttons
    await expect(page.locator('#save-api-key')).toBeAttached();
    await expect(page.locator('#close-api-key')).toBeAttached();
  });
});
