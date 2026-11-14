const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

/**
 * A little under a day, so even the longest jittered gap (23 h + 2%) can't skip a calendar day,
 * while it stays at about one request per day. The daily triggers run once per day
 * (lastDailyCheck in the store), also when two syncs land on the same day.
 */
export const SYNC_SCHEDULE = {
  intervalMs: 23 * HOUR_MS,
  startSpreadMs: 5 * MINUTE_MS,
  jitter: 0.02,
} as const;
