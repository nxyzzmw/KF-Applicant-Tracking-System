type CacheEntry<T> = {
  value: T
  expiresAt: number
}

const cache = new Map<string, CacheEntry<unknown>>()

export function readCache<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }
  return entry.value as T
}

export function writeCache<T>(key: string, value: T, ttlMs: number): void {
  cache.set(key, { value, expiresAt: Date.now() + Math.max(ttlMs, 0) })
}


export type CacheInvalidationListener = (prefix: string) => void

const invalidationListeners: CacheInvalidationListener[] = []

/**
 * Subscribe to cache invalidation events. The returned function can be
 * called to unsubscribe.
 */
export function subscribeCacheInvalidation(listener: CacheInvalidationListener): () => void {
  invalidationListeners.push(listener)
  return () => {
    const idx = invalidationListeners.indexOf(listener)
    if (idx !== -1) invalidationListeners.splice(idx, 1)
  }
}

export function invalidateCache(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key)
    }
  }
  // notify subscribers after cleaning so they can react (e.g. refetch)
  invalidationListeners.forEach((fn) => {
    try {
      fn(prefix)
    } catch {
      // ignore listener errors
    }
  })
}
