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
  private majorCallbacks: TickCallback[] = [];
  private minorCallbacks: TickCallback[] = [];
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
  public onMajorTick(callback: TickCallback): void {
    this.majorCallbacks.push(callback);
  }

  /**
   * Register a callback for minor ticks (UI updates).
   * @param callback Function to call when a minor tick occurs
   */
  public onMinorTick(callback: TickCallback): void {
    this.minorCallbacks.push(callback);
  }

  /**
   * Remove a previously registered major tick callback.
   * @param callback The callback to remove
   */
  public offMajorTick(callback: TickCallback): void {
    const index = this.majorCallbacks.indexOf(callback);
    if (index !== -1) {
      this.majorCallbacks.splice(index, 1);
    }
  }

  /**
   * Remove a previously registered minor tick callback.
   * @param callback The callback to remove
   */
  public offMinorTick(callback: TickCallback): void {
    const index = this.minorCallbacks.indexOf(callback);
    if (index !== -1) {
      this.minorCallbacks.splice(index, 1);
    }
  }

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
    const currentTimeSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

    const event: TickEvent = {
      type,
      timestamp,
      currentTimeSeconds,
    };

    const callbacks = type === TickType.Major ? this.majorCallbacks : this.minorCallbacks;

    callbacks.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error(`Error in ${type} tick callback:`, error);
      }
    });
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
import {
  TIMETABLE_REFRESH_INTERVAL_MS,
  CLOCK_UPDATE_INTERVAL_MS,
} from './config';

// Note: Major ticks handle both timetable AND status API refreshes.
// Both use TIMETABLE_REFRESH_INTERVAL_MS (5 minutes) as they refresh together.
export const tickManager = new TickManager(
  TIMETABLE_REFRESH_INTERVAL_MS, // Major ticks for API refresh (timetable + status)
  CLOCK_UPDATE_INTERVAL_MS, // Minor ticks for UI updates (clock, minutes)
);
