import { test, expect } from '@playwright/test';

test.describe('Location Modal', () => {
  test('should open location modal when location button is clicked', async ({ page }) => {
    await page.goto('/');
    
    // Mock geolocation permission denied to avoid browser prompts
    await page.context().grantPermissions([]);
    
    // Click location button
    await page.click('#location-button');
    
    // Check that modal is visible
    const modal = page.locator('#location-modal');
    await expect(modal).toBeVisible();
    
    // Check that modal header is present
    await expect(page.locator('#location-modal h2')).toHaveText('最寄り駅を選択');
  });

  test('should have location status and nearby stations list in modal', async ({ page }) => {
    await page.goto('/');
    
    await page.context().grantPermissions([]);
    await page.click('#location-button');
    
    // Check for location status
    await expect(page.locator('#location-status')).toBeVisible();
    
    // Check for nearby stations list container
    await expect(page.locator('#nearby-stations-list')).toBeVisible();
  });

  test('should have close button in location modal', async ({ page }) => {
    await page.goto('/');
    
    await page.context().grantPermissions([]);
    await page.click('#location-button');
    
    // Check for close button
    const closeButton = page.locator('#close-location-modal');
    await expect(closeButton).toBeVisible();
    await expect(closeButton).toHaveText('閉じる');
  });

  test('should close location modal when close button is clicked', async ({ page }) => {
    await page.goto('/');
    
    await page.context().grantPermissions([]);
    
    // Open modal
    await page.click('#location-button');
    const modal = page.locator('#location-modal');
    await expect(modal).toBeVisible();
    
    // Close modal
    await page.click('#close-location-modal');
    
    // Modal should be hidden
    await expect(modal).toBeHidden();
  });
});
