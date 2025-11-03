// src/tickManager.ts
// Global tick manager for coordinating major and minor ticks across the application
//
// Architecture:
// ┌─────────────────────────────────────────────────────────────────┐
// │ VisibilityManager                                               │
// │   └─ pauses/resumes TickManager when page is hidden/visible    │
// └─────────────────────────────────────────────────────────────────┘
//                              │
//                              ▼
// ┌─────────────────────────────────────────────────────────────────┐
// │ TickManager (Singleton)                                         │
// │   ├─ Major Ticks (every 5 min) ──→ API refresh callbacks       │
// │   └─ Minor Ticks (every 10 sec) ──→ UI update callbacks        │
// └─────────────────────────────────────────────────────────────────┘
//         │                                   │
//         ▼                                   ▼
// ┌──────────────────┐            ┌────────────────────┐
// │  boardRenderer   │            │  DeparturesList    │
// │  - fetchTimetable│            │  - updateMinutes   │
// │  - fetchStatus   │            │  - cleanDeparted   │
// │  - updateClock   │            │                    │
// └──────────────────┘            └────────────────────┘

/**
 * Tick types:
 * - Major: API refresh ticks (e.g., fetch timetable, status)
 * - Minor: UI update ticks (e.g., update minutes, clean departed trains, update clock)
 */
export enum TickType {
  Major = 'major',
  Minor = 'minor',
}

/**
 * Tick event containing current time and tick type
 */
export interface TickEvent {
  type: TickType;
  timestamp: number; // Unix timestamp in milliseconds
  currentTimeSeconds: number; // Seconds since midnight for UI calculations
  /**
   * Calling this will unsubscribe the current callback.
   * Provided to allow callbacks to unsubscribe themselves during execution.
   */
  unsubscribe: () => void;
}

/**
 * Callback function type for tick events
 */
type TickCallback = (event: TickEvent) => void;

/**
 * TickManager coordinates all periodic updates in the application.
 * Instead of components managing their own setInterval, they subscribe to tick events.
 * This provides better separation of concerns and cleaner integration with visibility management.
 */
export class TickManager {
  // Callback storage uses Maps and unsubscribe functions; arrays removed.
  // Internal id generator for subscriptions
  private nextCallbackId = 1;
  // Use maps to allow O(1) removal by id and to return unsubscribe functions
  private majorCallbackMap: Map<number, TickCallback> | undefined;
  private minorCallbackMap: Map<number, TickCallback> | undefined;
  private majorIntervalId: number | undefined;
  private minorIntervalId: number | undefined;
  private majorIntervalMs: number;
  private minorIntervalMs: number;
  private isRunning = false;

  /**
   * @param majorIntervalMs Interval for major ticks (API refreshes) in milliseconds
   * @param minorIntervalMs Interval for minor ticks (UI updates) in milliseconds
   */
  constructor(majorIntervalMs: number, minorIntervalMs: number) {
    this.majorIntervalMs = majorIntervalMs;
    this.minorIntervalMs = minorIntervalMs;
  }

  /**
   * Start the tick manager, emitting tick events at configured intervals.
   */
  public start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // Start major tick interval
    this.majorIntervalId = window.setInterval(() => {
      this.emitTick(TickType.Major);
    }, this.majorIntervalMs);

    // Start minor tick interval
    this.minorIntervalId = window.setInterval(() => {
      this.emitTick(TickType.Minor);
    }, this.minorIntervalMs);

    console.info('TickManager started');
  }

  /**
   * Stop the tick manager, clearing all intervals.
   */
  public stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.majorIntervalId !== undefined) {
      clearInterval(this.majorIntervalId);
      this.majorIntervalId = undefined;
    }

    if (this.minorIntervalId !== undefined) {
      clearInterval(this.minorIntervalId);
      this.minorIntervalId = undefined;
    }

    this.isRunning = false;
    console.info('TickManager stopped');
  }

  /**
   * Register a callback for major ticks (API refreshes).
   * @param callback Function to call when a major tick occurs
   */
  /**
   * Register a callback for major ticks (API refreshes).
   * Returns an unsubscribe function for easy cleanup.
   */
  public onMajorTick(callback: TickCallback): () => void {
    if (!this.majorCallbackMap) {
      this.majorCallbackMap = new Map<number, TickCallback>();
    }
    const id = this.nextCallbackId++;
    this.majorCallbackMap.set(id, callback);

    return () => {
      this.majorCallbackMap?.delete(id);
    };
  }

  /**
   * Register a callback for minor ticks (UI updates).
   * Returns an unsubscribe function for easy cleanup.
   */
  public onMinorTick(callback: TickCallback): () => void {
    if (!this.minorCallbackMap) {
      this.minorCallbackMap = new Map<number, TickCallback>();
    }
    const id = this.nextCallbackId++;
    this.minorCallbackMap.set(id, callback);

    return () => {
      this.minorCallbackMap?.delete(id);
    };
  }

  // Note: explicit removal by function reference has been removed. Use the
  // unsubscribe function returned by `onMajorTick` / `onMinorTick` instead.

  /**
   * Get whether the tick manager is currently running.
   */
  public getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Emit a tick event to all registered callbacks of the given type.
   * @param type The type of tick to emit
   */
  private emitTick(type: TickType): void {
    const now = new Date();
    const timestamp = now.getTime();
    // Use local time (seconds since local midnight). The UI displays local clock
    // and departure minutes relative to the user's timezone, so this must be
    // computed from local time.
    const currentTimeSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

    // Use map entries so we can provide an unsubscribe function specific
    // to each callback (so callbacks can remove themselves).
    if (type === TickType.Major) {
      if (!this.majorCallbackMap) return;
      const entries = Array.from(this.majorCallbackMap.entries());
      // Iterate over a snapshot of entries to protect against mutation
      for (const [id, callback] of entries) {
        const event: TickEvent = {
          type,
          timestamp,
          currentTimeSeconds,
          unsubscribe: () => {
            try {
              this.majorCallbackMap?.delete(id);
            } catch (e) {
              // ignore
            }
          },
        };

        try {
          callback(event);
        } catch (error) {
          console.error(`Error in ${type} tick callback:`, error);
        }
      }
    } else {
      if (!this.minorCallbackMap) return;
      const entries = Array.from(this.minorCallbackMap.entries());
      for (const [id, callback] of entries) {
        const event: TickEvent = {
          type,
          timestamp,
          currentTimeSeconds,
          unsubscribe: () => {
            try {
              this.minorCallbackMap?.delete(id);
            } catch (e) {
              // ignore
            }
          },
        };

        try {
          callback(event);
        } catch (error) {
          console.error(`Error in ${type} tick callback:`, error);
        }
      }
    }
  }

  /**
   * Manually trigger a tick event (useful for immediate updates or testing).
   * @param type The type of tick to emit
   */
  public triggerTick(type: TickType): void {
    this.emitTick(type);
  }
}

// Singleton instance for use across the app
// Import intervals from config for consistency
import { TIMETABLE_REFRESH_INTERVAL_MS, CLOCK_UPDATE_INTERVAL_MS } from './config';

// Note: Major ticks handle both timetable AND status API refreshes.
// Both use TIMETABLE_REFRESH_INTERVAL_MS (5 minutes) as they refresh together.
export const globalTickManager = new TickManager(
  TIMETABLE_REFRESH_INTERVAL_MS, // Major ticks for API refresh (timetable + status)
  CLOCK_UPDATE_INTERVAL_MS, // Minor ticks for UI updates (clock, minutes)
);
