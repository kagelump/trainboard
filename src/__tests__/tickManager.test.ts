import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TickManager, TickType } from '../tickManager';

describe('TickManager', () => {
  let tickManager: TickManager;

  beforeEach(() => {
    vi.useFakeTimers();
    // Create a new tick manager with short intervals for testing
    tickManager = new TickManager(1000, 500); // 1s major, 0.5s minor
  });

  afterEach(() => {
    tickManager.stop();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should start and stop correctly', () => {
    expect(tickManager.getIsRunning()).toBe(false);

    tickManager.start();
    expect(tickManager.getIsRunning()).toBe(true);

    tickManager.stop();
    expect(tickManager.getIsRunning()).toBe(false);
  });

  it('should not start multiple times', () => {
    tickManager.start();
    tickManager.start(); // Second start should be ignored
    expect(tickManager.getIsRunning()).toBe(true);
  });

  it('should emit major ticks at the configured interval', () => {
    const majorCallback = vi.fn();
    tickManager.onMajorTick(majorCallback);

    tickManager.start();

    // No tick yet
    expect(majorCallback).not.toHaveBeenCalled();

    // After 1 second, should have 1 major tick
    vi.advanceTimersByTime(1000);
    expect(majorCallback).toHaveBeenCalledTimes(1);
    expect(majorCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        type: TickType.Major,
        timestamp: expect.any(Number),
        currentTimeSeconds: expect.any(Number),
      }),
    );

    // After another second, should have 2 major ticks
    vi.advanceTimersByTime(1000);
    expect(majorCallback).toHaveBeenCalledTimes(2);
  });

  it('should emit minor ticks at the configured interval', () => {
    const minorCallback = vi.fn();
    tickManager.onMinorTick(minorCallback);

    tickManager.start();

    // No tick yet
    expect(minorCallback).not.toHaveBeenCalled();

    // After 0.5 seconds, should have 1 minor tick
    vi.advanceTimersByTime(500);
    expect(minorCallback).toHaveBeenCalledTimes(1);
    expect(minorCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        type: TickType.Minor,
        timestamp: expect.any(Number),
        currentTimeSeconds: expect.any(Number),
      }),
    );

    // After another 0.5 seconds, should have 2 minor ticks
    vi.advanceTimersByTime(500);
    expect(minorCallback).toHaveBeenCalledTimes(2);
  });

  it('should call multiple callbacks for the same tick type', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    tickManager.onMajorTick(callback1);
    tickManager.onMajorTick(callback2);

    tickManager.start();
    vi.advanceTimersByTime(1000);

    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);
  });

  it('should remove callbacks correctly', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    tickManager.onMajorTick(callback1);
    tickManager.onMajorTick(callback2);

    // Remove callback1
    tickManager.offMajorTick(callback1);

    tickManager.start();
    vi.advanceTimersByTime(1000);

    // callback1 should not be called
    expect(callback1).not.toHaveBeenCalled();
    // callback2 should still be called
    expect(callback2).toHaveBeenCalledTimes(1);
  });

  it('should stop emitting ticks when stopped', () => {
    const majorCallback = vi.fn();
    const minorCallback = vi.fn();

    tickManager.onMajorTick(majorCallback);
    tickManager.onMinorTick(minorCallback);

    tickManager.start();

    // Advance time to get some ticks
    vi.advanceTimersByTime(1000);
    expect(majorCallback).toHaveBeenCalledTimes(1);
    expect(minorCallback).toHaveBeenCalledTimes(2);

    // Stop the tick manager
    tickManager.stop();

    // Advance time further
    vi.advanceTimersByTime(2000);

    // No additional ticks should have been emitted
    expect(majorCallback).toHaveBeenCalledTimes(1);
    expect(minorCallback).toHaveBeenCalledTimes(2);
  });

  it('should manually trigger a tick', () => {
    const majorCallback = vi.fn();
    const minorCallback = vi.fn();

    tickManager.onMajorTick(majorCallback);
    tickManager.onMinorTick(minorCallback);

    // Don't start the tick manager, just trigger manually
    tickManager.triggerTick(TickType.Major);
    tickManager.triggerTick(TickType.Minor);

    expect(majorCallback).toHaveBeenCalledTimes(1);
    expect(minorCallback).toHaveBeenCalledTimes(1);
  });

  it('should handle errors in callbacks gracefully', () => {
    const errorCallback = vi.fn(() => {
      throw new Error('Test error');
    });
    const goodCallback = vi.fn();

    tickManager.onMajorTick(errorCallback);
    tickManager.onMajorTick(goodCallback);

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    tickManager.start();
    vi.advanceTimersByTime(1000);

    // Error should be logged but not thrown
    expect(consoleErrorSpy).toHaveBeenCalled();
    // Good callback should still be called
    expect(goodCallback).toHaveBeenCalledTimes(1);

    consoleErrorSpy.mockRestore();
  });

  it('should provide correct currentTimeSeconds in tick events', () => {
    const callback = vi.fn();
    tickManager.onMajorTick(callback);

    // Set system time to a specific local value (e.g., 10:30:45 local time)
    // Use the Date(year, monthIndex, day, hour, minute, second) constructor
    // which creates a date in the runtime's local timezone.
    const testDate = new Date(2024, 0, 1, 10, 30, 45); // 2024-01-01 10:30:45 local
    vi.setSystemTime(testDate);

    tickManager.start();
    vi.advanceTimersByTime(1000);

    // After advancing 1 second, the time should be 10:30:46
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        currentTimeSeconds: 10 * 3600 + 30 * 60 + 46, // 37846 seconds
      }),
    );
  });
});
