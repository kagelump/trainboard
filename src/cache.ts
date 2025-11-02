// src/cache.ts
// Small in-memory cache with optional TTL and simple LRU eviction.

/**
 * Simple in-memory cache with optional TTL and LRU eviction.
 * Supports optional persistence to localStorage.
 * @template V - The type of values stored in the cache
 */
export class SimpleCache<V> {
  private map = new Map<string, { v: V; expires?: number }>();

  /**
   * Creates a new SimpleCache instance.
   * @param maxEntries - Maximum number of entries before LRU eviction (default: 500)
   * @param ttlMs - Optional time-to-live in milliseconds for cache entries
   * @param persistKeyName - Optional localStorage key for persistence
   */
  constructor(
    private maxEntries = 500,
    private ttlMs?: number,
    private persistKeyName?: string,
  ) {
    if (persistKeyName && typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(persistKeyName);
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, { v: V; expires?: number }>;
          for (const k of Object.keys(parsed)) {
            const ent = parsed[k];
            if (!ent.expires || ent.expires > Date.now()) this.map.set(k, ent);
          }
        }
      } catch (error) {
        console.warn(`Failed to restore cache from localStorage key "${persistKeyName}":`, error);
      }
    }
  }

  /**
   * Retrieves a value from the cache.
   * @param key - The cache key
   * @returns The cached value or undefined if not found or expired
   */
  get(key: string): V | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (e.expires && e.expires <= Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    // refresh LRU ordering
    this.map.delete(key);
    this.map.set(key, e);
    return e.v;
  }

  /**
   * Stores a value in the cache with optional TTL.
   * Automatically evicts oldest entries if cache exceeds maxEntries.
   * @param key - The cache key
   * @param value - The value to store
   */
  set(key: string, value: V): void {
    const expires = this.ttlMs ? Date.now() + this.ttlMs : undefined;
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { v: value, expires });
    while (this.map.size > this.maxEntries) {
      // remove oldest entry
      const first = this.map.keys().next().value!;
      this.map.delete(first);
    }
    if (this.persistKeyName) this.persist();
  }

  /**
   * Checks if a key exists in the cache and is not expired.
   * @param key - The cache key to check
   * @returns true if the key exists and is valid, false otherwise
   */
  has(key: string): boolean {
    return typeof this.get(key) !== 'undefined';
  }

  private persist(): void {
    if (!this.persistKeyName) return;
    try {
      const obj: Record<string, { v: V; expires?: number }> = {};
      for (const [k, v] of this.map.entries()) obj[k] = v;
      localStorage.setItem(this.persistKeyName, JSON.stringify(obj));
    } catch (error) {
      console.warn(
        `Failed to persist cache to localStorage key "${this.persistKeyName}":`,
        error,
      );
    }
  }

  /**
   * Returns all cache keys currently stored (for testing/debugging).
   * @returns Array of cache keys
   */
  keys(): string[] {
    return Array.from(this.map.keys());
  }

  /**
   * Enables persistence to localStorage with the specified key.
   * @param keyName - The localStorage key to use for persistence
   */
  enablePersistence(keyName: string) {
    this.persistKeyName = keyName;
    this.persist();
  }
}
