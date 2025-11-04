import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { visibilityManager } from '../lib/visibilityManager';

/**
 * Integration test demonstrating the Page Visibility API in action
 * This test shows how the application automatically pauses and resumes
 * when the browser tab becomes inactive/active.
 */
describe('Page Visibility Integration', () => {
  beforeEach(() => {
    // Reset visibility manager state
    visibilityManager.destroy();
    // Use fake timers for testing
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should demonstrate automatic pause/resume behavior', () => {
    // Setup: Initialize the visibility manager
    visibilityManager.initialize();

    // Create a mock interval that represents app refresh logic
    let intervalCount = 0;
    let intervalId: number | undefined;

    const startInterval = () => {
      if (intervalId) return;
      intervalId = window.setInterval(() => {
        intervalCount++;
      }, 100);
    };

    const stopInterval = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
    };

    // Register callback to pause/resume based on visibility
    visibilityManager.onVisibilityChange((isVisible) => {
      if (isVisible) {
        startInterval();
      } else {
        stopInterval();
      }
    });

    // Start the interval
    startInterval();
    expect(intervalId).toBeDefined();

    // Simulate: Wait for some intervals to fire (page is visible)
    vi.advanceTimersByTime(300);
    const visibleCount = intervalCount;
    expect(visibleCount).toBeGreaterThan(0);

    // Simulate: User switches to another tab (page becomes hidden)
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    // Verify: Interval should be stopped
    expect(intervalId).toBeUndefined();

    // Simulate: Time passes while tab is inactive (no intervals should fire)
    const countWhenHidden = intervalCount;
    vi.advanceTimersByTime(500);
    expect(intervalCount).toBe(countWhenHidden); // No change

    // Simulate: User switches back to this tab (page becomes visible)
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => false,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    // Verify: Interval should be restarted
    expect(intervalId).toBeDefined();

    // Verify: Intervals resume firing
    vi.advanceTimersByTime(300);
    expect(intervalCount).toBeGreaterThan(countWhenHidden);

    // Cleanup
    stopInterval();
    visibilityManager.destroy();
  });

  it('should handle multiple components pausing independently', () => {
    visibilityManager.initialize();

    // Simulate two components with their own intervals
    let component1Active = true;
    let component2Active = true;

    const callback1 = vi.fn((isVisible: boolean) => {
      component1Active = isVisible;
    });

    const callback2 = vi.fn((isVisible: boolean) => {
      component2Active = isVisible;
    });

    visibilityManager.onVisibilityChange(callback1);
    visibilityManager.onVisibilityChange(callback2);

    // Both should be active initially
    expect(component1Active).toBe(true);
    expect(component2Active).toBe(true);

    // Simulate page becoming hidden
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    // Both callbacks should be called with false
    expect(callback1).toHaveBeenCalledWith(false);
    expect(callback2).toHaveBeenCalledWith(false);
    expect(component1Active).toBe(false);
    expect(component2Active).toBe(false);

    // Simulate page becoming visible again
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => false,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    // Both callbacks should be called with true
    expect(callback1).toHaveBeenCalledWith(true);
    expect(callback2).toHaveBeenCalledWith(true);
    expect(component1Active).toBe(true);
    expect(component2Active).toBe(true);

    visibilityManager.destroy();
  });
});
