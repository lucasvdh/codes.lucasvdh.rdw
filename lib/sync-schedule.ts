const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

/** How often a vehicle is synced. */
export const SYNC_SCHEDULE = {
  intervalMs: 24 * HOUR_MS,
  startSpreadMs: 5 * MINUTE_MS,
  jitter: 0,
} as const;
