import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { VehicleRecord } from "../../lib/vehicle";

/** Sanitized RDW response. The plate contains vowels, which the RDW never issues. */
export function vehicleResponse(): unknown[] {
  return JSON.parse(readFileSync(join(__dirname, "..", "..", "..", "tests", "fixtures", "vehicle.json"), "utf8")) as unknown[];
}

export function vehicle(overrides: Partial<VehicleRecord> = {}): VehicleRecord {
  return {
    kenteken: "AE01IO",
    voertuigsoort: "Personenauto",
    merk: "TESTMERK",
    handelsbenaming: "MODEL X",
    vervaldatum_apk: "20270115",
    wam_verzekerd: "Ja",
    openstaande_terugroepactie_indicator: "Nee",
    ...overrides,
  };
}
