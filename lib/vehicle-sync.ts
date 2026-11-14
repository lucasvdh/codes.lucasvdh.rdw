import {
  calendarDateIn,
  daysBetween,
  isoDate,
  parseIsoDate,
  parseRdwDate,
  type CalendarDate,
} from "./apk-date";
import type { VehicleRecord } from "./vehicle";

export const STORE = {
  LICENSE_PLATE: "license_plate",
  LAST_DAILY_CHECK: "last_daily_check",
  OUTAGE_START: "rdw_outage_start",
  APK_EXPIRY_DATE: "apk_expiry_date",
  OPEN_RECALL: "open_recall_indicator",
  IS_INSURED: "is_insured",
} as const;

export const RDW_YES = "Ja";
export const RDW_NO = "Nee";

const MONTH_NOTICE_DAYS = 30;

/** What the device remembers from the previous sync (device store). */
export interface VehicleSnapshot {
  apkExpiryDate?: string;
  openRecall?: string;
  isInsured?: string;
  /** Homey-local date (yyyy-mm-dd) of the last sync that evaluated the daily triggers. */
  lastDailyCheck?: string;
}

/** null clears a capability: the RDW has no value for it. */
export interface CapabilityValues {
  license_plate: string;
  vehicle_type: string | null;
  brand: string | null;
  trade_name: string | null;
  is_insured: string | null;
  apk_expiry_date: string | null;
  open_recall_indicator: string | null;
}

function orNull(value: string): string | null {
  return value === "" ? null : value;
}

export type NotificationKey = "messages.has_expired" | "messages.expires_in_a_month";

export type SyncEvent =
  | { type: "notification"; key: NotificationKey }
  | { type: "apk_expired" }
  | { type: "upcoming_apk_expiry_date"; daysUntilApk: number }
  | { type: "apk_expiry_date_changed"; newDate: string }
  | { type: "open_recall" }
  | { type: "insurance_has_expired" };

export interface SyncPlan {
  capabilities: CapabilityValues;
  /** In the order they must be fired. */
  events: SyncEvent[];
  snapshot: Required<VehicleSnapshot>;
}

/** A change from a known earlier value; the first observation after pairing is only a baseline. */
function changedTo(previous: string | undefined, current: string, target: string): boolean {
  return previous !== undefined && previous !== current && current === target;
}

/** True when a countdown went from above `threshold` to `threshold` or below. */
function crossed(before: number, now: number, threshold: number): boolean {
  return before > threshold && now <= threshold;
}

/**
 * Notifications and the daily APK triggers. A missed day still crosses a threshold; without an
 * earlier check (first sync after pairing or after updating the app) yesterday is assumed.
 */
function dailyApkEvents(expiry: CalendarDate, today: CalendarDate, lastCheck: CalendarDate | undefined): SyncEvent[] {
  const days = daysBetween(today, expiry);
  const daysAtLastCheck = lastCheck ? daysBetween(lastCheck, expiry) : days + 1;
  const events: SyncEvent[] = [];

  if (crossed(daysAtLastCheck, days, 0)) {
    events.push({ type: "notification", key: "messages.has_expired" });
  } else if (crossed(daysAtLastCheck, days, MONTH_NOTICE_DAYS)) {
    events.push({ type: "notification", key: "messages.expires_in_a_month" });
  }
  if (days <= 0) events.push({ type: "apk_expired" });
  events.push({ type: "upcoming_apk_expiry_date", daysUntilApk: days });
  return events;
}

export function planVehicleSync(
  previous: VehicleSnapshot,
  vehicle: VehicleRecord,
  now: Date,
  timeZone: string,
): SyncPlan {
  const today = calendarDateIn(timeZone, now);
  const todayIso = isoDate(today);
  const expiry = parseRdwDate(vehicle.vervaldatum_apk);
  const events: SyncEvent[] = [];

  if (expiry && previous.lastDailyCheck !== todayIso) {
    const lastCheck = previous.lastDailyCheck ? parseIsoDate(previous.lastDailyCheck) : undefined;
    events.push(...dailyApkEvents(expiry, today, lastCheck));
  }

  if (expiry && previous.apkExpiryDate !== undefined && previous.apkExpiryDate !== vehicle.vervaldatum_apk) {
    events.push({ type: "apk_expiry_date_changed", newDate: isoDate(expiry) });
  }
  if (changedTo(previous.openRecall, vehicle.openstaande_terugroepactie_indicator, RDW_YES)) {
    events.push({ type: "open_recall" });
  }
  if (previous.isInsured === RDW_YES && vehicle.wam_verzekerd === RDW_NO) {
    events.push({ type: "insurance_has_expired" });
  }

  return {
    capabilities: {
      license_plate: vehicle.kenteken,
      vehicle_type: orNull(vehicle.voertuigsoort),
      brand: orNull(vehicle.merk),
      trade_name: orNull(vehicle.handelsbenaming),
      is_insured: orNull(vehicle.wam_verzekerd),
      apk_expiry_date: expiry ? isoDate(expiry) : null,
      open_recall_indicator: orNull(vehicle.openstaande_terugroepactie_indicator),
    },
    events,
    snapshot: {
      apkExpiryDate: vehicle.vervaldatum_apk,
      openRecall: vehicle.openstaande_terugroepactie_indicator,
      isInsured: vehicle.wam_verzekerd,
      lastDailyCheck: todayIso,
    },
  };
}

/** Matches the upcoming-APK trigger to a Flow's "expires in N days" argument. */
export function matchesUpcomingApk(flowDays: number, daysUntilApk: number): boolean {
  return flowDays >= daysUntilApk;
}

export function isApkExpired(rdwDate: string, now: Date, timeZone: string): boolean {
  const expiry = parseRdwDate(rdwDate);
  return expiry !== undefined && daysBetween(calendarDateIn(timeZone, now), expiry) <= 0;
}
