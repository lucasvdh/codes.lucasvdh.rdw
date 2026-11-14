const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

/**
 * Twice a day, so drift can never leave a calendar day without a check; the daily triggers
 * still run once per day (lastDailyCheck in the store).
 */
export const SYNC_SCHEDULE = {
  intervalMs: 12 * HOUR_MS,
  startSpreadMs: 5 * MINUTE_MS,
  jitter: 0.05,
} as const;
