import { daysUntilApkDate, formatApkDate } from "./apk-date";
import type { VehicleRecord } from "./vehicle";

export const STORE = {
  LICENSE_PLATE: "license_plate",
  APK_EXPIRY_DATE: "apk_expiry_date",
  OPEN_RECALL: "open_recall_indicator",
  IS_INSURED: "is_insured",
} as const;

export const RDW_YES = "Ja";
export const RDW_NO = "Nee";

/** What the device remembers from the previous sync (device store). */
export interface VehicleSnapshot {
  apkExpiryDate?: string;
  openRecall?: string;
  isInsured?: string;
  /** Homey-local date (yyyy-mm-dd) of the last sync that evaluated the daily triggers. */
  lastDailyCheck?: string;
}

export interface CapabilityValues {
  license_plate: string;
  vehicle_type: string;
  brand: string;
  trade_name: string;
  is_insured: string;
  apk_expiry_date: string;
  open_recall_indicator: string;
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

export function planVehicleSync(
  previous: VehicleSnapshot,
  vehicle: VehicleRecord,
  now: Date,
  _timeZone: string,
): SyncPlan {
  const events: SyncEvent[] = [];
  const daysUntilApk = daysUntilApkDate(vehicle.vervaldatum_apk, now);

  if (daysUntilApk === 0) events.push({ type: "notification", key: "messages.has_expired" });
  if (daysUntilApk === 30) events.push({ type: "notification", key: "messages.expires_in_a_month" });
  if (daysUntilApk <= 0) events.push({ type: "apk_expired" });
  events.push({ type: "upcoming_apk_expiry_date", daysUntilApk });

  if (previous.apkExpiryDate !== undefined && previous.apkExpiryDate !== vehicle.vervaldatum_apk) {
    events.push({ type: "apk_expiry_date_changed", newDate: formatApkDate(vehicle.vervaldatum_apk) });
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
      vehicle_type: vehicle.voertuigsoort,
      brand: vehicle.merk,
      trade_name: vehicle.handelsbenaming,
      is_insured: vehicle.wam_verzekerd,
      apk_expiry_date: formatApkDate(vehicle.vervaldatum_apk),
      open_recall_indicator: vehicle.openstaande_terugroepactie_indicator,
    },
    events,
    snapshot: {
      apkExpiryDate: vehicle.vervaldatum_apk,
      openRecall: vehicle.openstaande_terugroepactie_indicator,
      isInsured: vehicle.wam_verzekerd,
      lastDailyCheck: "",
    },
  };
}

/** Matches the upcoming-APK trigger to a Flow's "expires in N days" argument. */
export function matchesUpcomingApk(flowDays: number, daysUntilApk: number): boolean {
  return flowDays >= daysUntilApk;
}

export function isApkExpired(rdwDate: string, now: Date, _timeZone: string): boolean {
  return daysUntilApkDate(rdwDate, now) <= 0;
}
