const DAY_MS = 24 * 60 * 60 * 1000;

export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

/** RDW dates are `yyyymmdd`. */
export function parseRdwDate(rdwDate: string): CalendarDate | undefined {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(rdwDate);
  if (!match) return undefined;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** `yyyy-mm-dd`, as Flow tokens and capabilities show dates. */
export function isoDate(date: CalendarDate): string {
  const pad = (n: number, width: number) => String(n).padStart(width, "0");
  return `${pad(date.year, 4)}-${pad(date.month, 2)}-${pad(date.day, 2)}`;
}

export function parseIsoDate(iso: string): CalendarDate | undefined {
  return parseRdwDate(iso.replace(/-/g, ""));
}

/** The calendar date at `now` in a timezone such as Homey's (`homey.clock.getTimezone()`). */
export function calendarDateIn(timeZone: string, now: Date): CalendarDate {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "numeric", day: "numeric" })
    .formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  return { year: part("year"), month: part("month"), day: part("day") };
}

/** Whole calendar days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: CalendarDate, to: CalendarDate): number {
  return Math.round((Date.UTC(to.year, to.month - 1, to.day) - Date.UTC(from.year, from.month - 1, from.day)) / DAY_MS);
}
