// src/visibilityManager.ts
// Manages page visibility state to pause/resume app activity for CPU savings

/**
 * Callback function type for visibility changes
 */
type VisibilityCallback = (isVisible: boolean) => void;

/**
 * VisibilityManager handles Page Visibility API to pause/resume app activity
 * when the tab becomes hidden/visible. This saves CPU cycles, especially
 * important for Raspberry Pi deployments with limited resources.
 */
export class VisibilityManager {
  private callbacks: VisibilityCallback[] = [];
  private isVisible: boolean = true;
  private listener: (() => void) | null = null;

  constructor() {
    this.isVisible = !document.hidden;
  }

  /**
   * Initialize the visibility manager and start listening to visibility changes.
   */
  public initialize(): void {
    if (this.listener) {
      // Already initialized
      return;
    }

    this.listener = () => this.handleVisibilityChange();
    document.addEventListener('visibilitychange', this.listener);

    // Log initial state
    console.info(`VisibilityManager initialized. Page is ${this.isVisible ? 'visible' : 'hidden'}`);
  }

  /**
   * Clean up event listeners when no longer needed.
   */
  public destroy(): void {
    if (this.listener) {
      document.removeEventListener('visibilitychange', this.listener);
      this.listener = null;
    }
  }

  /**
   * Register a callback to be called when visibility changes.
   * @param callback Function to call with visibility state (true = visible, false = hidden)
   */
  public onVisibilityChange(callback: VisibilityCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Remove a previously registered callback.
   * @param callback The callback to remove
   */
  public offVisibilityChange(callback: VisibilityCallback): void {
    const index = this.callbacks.indexOf(callback);
    if (index !== -1) {
      this.callbacks.splice(index, 1);
    }
  }

  /**
   * Get the current visibility state.
   * @returns true if page is visible, false if hidden
   */
  public getIsVisible(): boolean {
    return this.isVisible;
  }

  /**
   * Handle visibility change events from the Page Visibility API.
   */
  private handleVisibilityChange(): void {
    const wasVisible = this.isVisible;
    this.isVisible = !document.hidden;

    if (wasVisible !== this.isVisible) {
      console.info(`Page visibility changed: ${this.isVisible ? 'visible' : 'hidden'}`);

      // Notify all registered callbacks
      this.callbacks.forEach((callback) => {
        try {
          callback(this.isVisible);
        } catch (error) {
          console.error('Error in visibility callback:', error);
        }
      });
    }
  }
}

// Singleton instance for use across the app
export const visibilityManager = new VisibilityManager();
