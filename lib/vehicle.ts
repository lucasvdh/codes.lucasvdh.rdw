import { RdwResponseError } from "./errors";

/** The fields of an RDW "Gekentekende voertuigen" (m9d7-ebf2) record that the app uses. */
export interface VehicleRecord {
  kenteken: string;
  voertuigsoort: string;
  merk: string;
  handelsbenaming: string;
  vervaldatum_apk: string;
  wam_verzekerd: string;
  openstaande_terugroepactie_indicator: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  return typeof value === "string" ? value : "";
}

/** Picks the first vehicle from an RDW response body, or undefined when there is none. */
export function parseVehicleResponse(body: unknown): VehicleRecord | undefined {
  if (!Array.isArray(body)) throw new RdwResponseError("RDW response is not a list of vehicles");
  const first: unknown = body[0];
  if (!isRecord(first) || typeof first.kenteken !== "string") return undefined;

  return {
    kenteken: first.kenteken,
    voertuigsoort: text(first, "voertuigsoort"),
    merk: text(first, "merk"),
    handelsbenaming: text(first, "handelsbenaming"),
    vervaldatum_apk: text(first, "vervaldatum_apk"),
    wam_verzekerd: text(first, "wam_verzekerd"),
    openstaande_terugroepactie_indicator: text(first, "openstaande_terugroepactie_indicator"),
  };
}
