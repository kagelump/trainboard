import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TickManager, TickType } from '../lib/tickManager';
import { visibilityManager } from '../lib/visibilityManager';

/**
 * Integration test demonstrating how TickManager works with VisibilityManager
 * to pause/resume ticks when the page is hidden/visible.
 */
describe('TickManager and VisibilityManager Integration', () => {
  let tickManager: TickManager;

  beforeEach(() => {
    vi.useFakeTimers();
    // Reset visibility manager state
    visibilityManager.destroy();
    // Create a new tick manager with short intervals for testing
    tickManager = new TickManager(1000, 500); // 1s major, 0.5s minor
  });

  afterEach(() => {
    tickManager.stop();
    visibilityManager.destroy();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should pause ticks when page becomes hidden and resume when visible', () => {
    // Setup: Initialize the visibility manager
    visibilityManager.initialize();

    // Track tick events
    let majorTickCount = 0;
    let minorTickCount = 0;

    tickManager.onMajorTick(() => {
      majorTickCount++;
    });

    tickManager.onMinorTick(() => {
      minorTickCount++;
    });

    // Register callback to pause/resume tick manager based on visibility
    visibilityManager.onVisibilityChange((isVisible) => {
      if (isVisible) {
        tickManager.start();
      } else {
        tickManager.stop();
      }
    });

    // Start the tick manager
    tickManager.start();
    expect(tickManager.getIsRunning()).toBe(true);

    // Simulate: Wait for some ticks to fire (page is visible)
    vi.advanceTimersByTime(1000);
    expect(majorTickCount).toBe(1);
    expect(minorTickCount).toBe(2); // 2 minor ticks in 1 second (500ms interval)

    // Simulate: User switches to another tab (page becomes hidden)
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    // Verify: Tick manager should be stopped
    expect(tickManager.getIsRunning()).toBe(false);

    // Simulate: Time passes while tab is inactive (no ticks should fire)
    const majorCountWhenHidden = majorTickCount;
    const minorCountWhenHidden = minorTickCount;
    vi.advanceTimersByTime(2000);
    expect(majorTickCount).toBe(majorCountWhenHidden); // No change
    expect(minorTickCount).toBe(minorCountWhenHidden); // No change

    // Simulate: User switches back to this tab (page becomes visible)
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => false,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    // Verify: Tick manager should be restarted
    expect(tickManager.getIsRunning()).toBe(true);

    // Verify: Ticks resume firing
    vi.advanceTimersByTime(1000);
    expect(majorTickCount).toBeGreaterThan(majorCountWhenHidden);
    expect(minorTickCount).toBeGreaterThan(minorCountWhenHidden);

    // Cleanup
    visibilityManager.destroy();
  });

  it('should coordinate multiple tick types with visibility changes', () => {
    visibilityManager.initialize();

    // Track different tick types separately
    const majorTicks: number[] = [];
    const minorTicks: number[] = [];

    tickManager.onMajorTick((event) => {
      majorTicks.push(event.timestamp);
    });

    tickManager.onMinorTick((event) => {
      minorTicks.push(event.timestamp);
    });

    // Setup visibility callback
    visibilityManager.onVisibilityChange((isVisible) => {
      if (isVisible) {
        tickManager.start();
      } else {
        tickManager.stop();
      }
    });

    // Start ticking
    tickManager.start();

    // Collect some ticks
    vi.advanceTimersByTime(1500);
    const majorCount1 = majorTicks.length;
    const minorCount1 = minorTicks.length;
    expect(majorCount1).toBeGreaterThan(0);
    expect(minorCount1).toBeGreaterThan(0);

    // Hide the page
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    // No new ticks while hidden
    vi.advanceTimersByTime(2000);
    expect(majorTicks.length).toBe(majorCount1);
    expect(minorTicks.length).toBe(minorCount1);

    // Show the page again
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => false,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    // Ticks resume
    vi.advanceTimersByTime(1500);
    expect(majorTicks.length).toBeGreaterThan(majorCount1);
    expect(minorTicks.length).toBeGreaterThan(minorCount1);

    visibilityManager.destroy();
  });
});
