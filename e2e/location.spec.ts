import { test, expect } from '@playwright/test';

test.describe('Location Modal', () => {
  test('should open location modal when location button is clicked', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Deny geolocation permission to avoid browser prompts in tests
    await page.context().grantPermissions([]);
    
    // Wait for location button to be ready
    await page.waitForSelector('#location-button', { state: 'visible' });
    
    // Click location button
    await page.click('#location-button');
    
    // Wait for modal to be visible (check for flex class)
    const modal = page.locator('#location-modal');
    await page.waitForSelector('#location-modal.flex', { state: 'visible' });
    await expect(modal).toHaveClass(/flex/);
    
    // Check that modal header is present
    await expect(page.locator('#location-modal h2')).toHaveText('最寄り駅を選択');
  });

  test('should have location status and nearby stations list in modal', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    
    await page.context().grantPermissions([]);
    await page.waitForSelector('#location-button', { state: 'visible' });
    await page.click('#location-button');
    
    // Wait for modal to be visible
    await page.waitForSelector('#location-modal.flex', { state: 'visible' });
    
    // Check for location status
    await expect(page.locator('#location-status')).toBeVisible();
    
    // Check for nearby stations list container
    await expect(page.locator('#nearby-stations-list')).toBeVisible();
  });

  test('should have close button in location modal', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    
    await page.context().grantPermissions([]);
    await page.waitForSelector('#location-button', { state: 'visible' });
    await page.click('#location-button');
    
    // Wait for modal to be visible
    await page.waitForSelector('#location-modal.flex', { state: 'visible' });
    
    // Check for close button
    const closeButton = page.locator('#close-location-modal');
    await expect(closeButton).toBeVisible();
    await expect(closeButton).toHaveText('閉じる');
  });

  test('should close location modal when close button is clicked', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    
    await page.context().grantPermissions([]);
    await page.waitForSelector('#location-button', { state: 'visible' });
    
    // Open modal
    await page.click('#location-button');
    const modal = page.locator('#location-modal');
    await page.waitForSelector('#location-modal.flex', { state: 'visible' });
    await expect(modal).toHaveClass(/flex/);
    
    // Close modal
    await page.click('#close-location-modal');
    
    // Modal should be hidden (wait for class change)
    await expect(modal).toHaveClass(/hidden/);
  });
});
