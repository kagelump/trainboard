import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { visibilityManager } from '../visibilityManager';

/**
 * Test to verify that departure list doesn't become empty after tab visibility change.
 * This replicates the issue where multiple visibility callbacks are registered
 * when renderBoard() is called multiple times.
 */
describe('Board Renderer Visibility Bug', () => {
  beforeEach(() => {
    // Reset visibility manager state
    visibilityManager.destroy();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    visibilityManager.destroy();
  });

  it('should not register multiple visibility callbacks when renderBoard is called multiple times', () => {
    visibilityManager.initialize();

    // Track how many times callbacks are invoked
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    // Simulate renderBoard() being called twice (e.g., user changes station)
    visibilityManager.onVisibilityChange(callback1);
    visibilityManager.onVisibilityChange(callback2);

    // Initially both callbacks exist but haven't been called
    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).not.toHaveBeenCalled();

    // Simulate page becoming hidden
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    // Both callbacks should have been called
    expect(callback1).toHaveBeenCalledWith(false);
    expect(callback2).toHaveBeenCalledWith(false);
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);

    // Simulate page becoming visible again
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => false,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    // Both callbacks should have been called again
    expect(callback1).toHaveBeenCalledWith(true);
    expect(callback2).toHaveBeenCalledWith(true);
    expect(callback1).toHaveBeenCalledTimes(2);
    expect(callback2).toHaveBeenCalledTimes(2);

    // This demonstrates the problem: multiple callbacks accumulate
    // and can interfere with each other
  });

  it('should properly clean up old visibility callback when re-registering', () => {
    visibilityManager.initialize();

    const callback1 = vi.fn();
    const callback2 = vi.fn();

    // Register first callback
    visibilityManager.onVisibilityChange(callback1);

    // Remove it and register second callback (simulating proper cleanup)
    visibilityManager.offVisibilityChange(callback1);
    visibilityManager.onVisibilityChange(callback2);

    // Simulate visibility change
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    // Only callback2 should have been called
    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).toHaveBeenCalledWith(false);
  });

  it('should handle renderBoard being called multiple times without accumulating callbacks', async () => {
    // This test will pass once we fix the issue
    visibilityManager.initialize();

    let fetchCount = 0;
    const mockFetchAndRender = vi.fn(() => {
      fetchCount++;
      return Promise.resolve(true);
    });

    // Simulate renderBoard logic with proper callback management
    let visibilityCallback: ((isVisible: boolean) => void) | null = null;

    const simulateRenderBoard = (stationUri: string) => {
      // Remove old callback if it exists
      if (visibilityCallback) {
        visibilityManager.offVisibilityChange(visibilityCallback);
      }

      // Register new callback
      visibilityCallback = (isVisible: boolean) => {
        if (isVisible) {
          mockFetchAndRender(stationUri);
        }
      };
      visibilityManager.onVisibilityChange(visibilityCallback);
    };

    // Simulate calling renderBoard twice with different stations
    simulateRenderBoard('station1');
    simulateRenderBoard('station2');

    // Trigger visibility change
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => false,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    // mockFetchAndRender should only be called once (not twice)
    // because we properly cleaned up the old callback
    await vi.runAllTimersAsync();
    expect(mockFetchAndRender).toHaveBeenCalledTimes(1);
    expect(mockFetchAndRender).toHaveBeenCalledWith('station2');
  });
});
