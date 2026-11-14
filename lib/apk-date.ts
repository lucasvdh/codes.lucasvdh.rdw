const DAY_MS = 24 * 60 * 60 * 1000;

/** RDW dates are `yyyymmdd`; Flow tokens and capabilities show `yyyy-mm-dd`. */
export function formatApkDate(rdwDate: string): string {
  return `${rdwDate.substring(0, 4)}-${rdwDate.substring(4, 6)}-${rdwDate.substring(6, 8)}`;
}

export function daysUntilApkDate(rdwDate: string, now: Date): number {
  const year = parseInt(rdwDate.slice(0, 4), 10);
  const monthIndex = parseInt(rdwDate.slice(4, 6), 10) - 1;
  const day = parseInt(rdwDate.slice(6, 8), 10);
  const expiry = new Date(year, monthIndex, day);
  return Math.floor((expiry.getTime() - now.getTime()) / DAY_MS);
}
