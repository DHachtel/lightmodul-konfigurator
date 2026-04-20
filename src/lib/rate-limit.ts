/**
 * In-Memory Rate Limiter für API-Routen.
 * Begrenzt Anfragen pro IP innerhalb eines Zeitfensters.
 * Räumt abgelaufene Einträge automatisch auf.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Alte Einträge alle 60 Sekunden aufräumen
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60_000;

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  const cutoff = now - windowMs;
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter(t => t > cutoff);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}

/**
 * Prüft ob eine Anfrage erlaubt ist.
 * @param key   Eindeutiger Schlüssel (z.B. "orders:1.2.3.4")
 * @param limit Max. Anzahl Anfragen im Zeitfenster
 * @param windowMs Zeitfenster in Millisekunden
 * @returns { allowed, remaining } — ob erlaubt + verbleibende Anfragen
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; remaining: number } {
  cleanup(windowMs);

  const now = Date.now();
  const cutoff = now - windowMs;

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Alte Timestamps für diesen Key entfernen
  entry.timestamps = entry.timestamps.filter(t => t > cutoff);

  if (entry.timestamps.length >= limit) {
    return { allowed: false, remaining: 0 };
  }

  entry.timestamps.push(now);
  return { allowed: true, remaining: limit - entry.timestamps.length };
}
