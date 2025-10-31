// src/cache.ts
// Small in-memory cache with optional TTL and simple LRU eviction.

export class SimpleCache<V> {
  private map = new Map<string, { v: V; expires?: number }>();

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
      } catch (e) {
        // ignore
      }
    }
  }

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

  has(key: string): boolean {
    return typeof this.get(key) !== 'undefined';
  }

  private persist(): void {
    if (!this.persistKeyName) return;
    try {
      const obj: Record<string, { v: V; expires?: number }> = {};
      for (const [k, v] of this.map.entries()) obj[k] = v;
      localStorage.setItem(this.persistKeyName, JSON.stringify(obj));
    } catch (e) {
      // ignore
    }
  }

  // expose for tests/debug
  keys(): string[] {
    return Array.from(this.map.keys());
  }

  // allow setting a persistent key name after construction
  enablePersistence(keyName: string) {
    this.persistKeyName = keyName;
    this.persist();
  }
}
