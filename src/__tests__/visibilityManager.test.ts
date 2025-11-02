import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VisibilityManager } from '../visibilityManager';

describe('VisibilityManager', () => {
  let manager: VisibilityManager;
  let visibilityChangeListener: ((this: Document, ev: Event) => any) | null = null;

  beforeEach(() => {
    // Mock document.hidden and visibilitychange event
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => false,
    });

    // Capture the event listener
    const originalAddEventListener = document.addEventListener;
    vi.spyOn(document, 'addEventListener').mockImplementation((type, listener) => {
      if (type === 'visibilitychange') {
        visibilityChangeListener = listener as any;
      }
      return originalAddEventListener.call(document, type, listener);
    });

    manager = new VisibilityManager();
  });

  afterEach(() => {
    manager.destroy();
    vi.restoreAllMocks();
    visibilityChangeListener = null;
  });

  it('should initialize with page visible', () => {
    expect(manager.getIsVisible()).toBe(true);
  });

  it('should register event listener on initialize', () => {
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    manager.initialize();
    expect(addEventListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });

  it('should not register multiple listeners if initialized twice', () => {
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    manager.initialize();
    manager.initialize();
    expect(addEventListenerSpy).toHaveBeenCalledTimes(1);
  });

  it('should remove event listener on destroy', () => {
    manager.initialize();
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
    manager.destroy();
    expect(removeEventListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });

  it('should call registered callbacks when visibility changes', () => {
    manager.initialize();
    const callback = vi.fn();
    manager.onVisibilityChange(callback);

    // Simulate page becoming hidden
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    });
    if (visibilityChangeListener) {
      visibilityChangeListener.call(document, new Event('visibilitychange'));
    }

    expect(callback).toHaveBeenCalledWith(false);
    expect(manager.getIsVisible()).toBe(false);

    // Simulate page becoming visible again
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => false,
    });
    if (visibilityChangeListener) {
      visibilityChangeListener.call(document, new Event('visibilitychange'));
    }

    expect(callback).toHaveBeenCalledWith(true);
    expect(manager.getIsVisible()).toBe(true);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('should not call callbacks if visibility does not actually change', () => {
    manager.initialize();
    const callback = vi.fn();
    manager.onVisibilityChange(callback);

    // Trigger event without actually changing document.hidden
    if (visibilityChangeListener) {
      visibilityChangeListener.call(document, new Event('visibilitychange'));
    }

    expect(callback).not.toHaveBeenCalled();
  });

  it('should allow removing callbacks', () => {
    manager.initialize();
    const callback = vi.fn();
    manager.onVisibilityChange(callback);
    manager.offVisibilityChange(callback);

    // Simulate visibility change
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    });
    if (visibilityChangeListener) {
      visibilityChangeListener.call(document, new Event('visibilitychange'));
    }

    expect(callback).not.toHaveBeenCalled();
  });

  it('should handle errors in callbacks gracefully', () => {
    manager.initialize();
    const errorCallback = vi.fn(() => {
      throw new Error('Test error');
    });
    const normalCallback = vi.fn();

    manager.onVisibilityChange(errorCallback);
    manager.onVisibilityChange(normalCallback);

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Simulate visibility change
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    });
    if (visibilityChangeListener) {
      visibilityChangeListener.call(document, new Event('visibilitychange'));
    }

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(normalCallback).toHaveBeenCalledWith(false);
    consoleErrorSpy.mockRestore();
  });

  it('should support multiple callbacks', () => {
    manager.initialize();
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    manager.onVisibilityChange(callback1);
    manager.onVisibilityChange(callback2);

    // Simulate visibility change
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    });
    if (visibilityChangeListener) {
      visibilityChangeListener.call(document, new Event('visibilitychange'));
    }

    expect(callback1).toHaveBeenCalledWith(false);
    expect(callback2).toHaveBeenCalledWith(false);
  });
});
