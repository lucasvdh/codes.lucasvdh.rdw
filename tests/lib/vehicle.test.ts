import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RdwResponseError } from "../../lib/errors";
import { parseVehicleResponse } from "../../lib/vehicle";
import { vehicleResponse } from "../helpers/fixtures";

describe("parseVehicleResponse", () => {
  it("picks the fields the app uses from the first record", () => {
    assert.deepEqual(parseVehicleResponse(vehicleResponse()), {
      kenteken: "AE01IO",
      voertuigsoort: "Personenauto",
      merk: "TESTMERK",
      handelsbenaming: "MODEL X",
      vervaldatum_apk: "20270115",
      wam_verzekerd: "Ja",
      openstaande_terugroepactie_indicator: "Nee",
    });
  });

  it("returns undefined for an empty result (unknown plate)", () => {
    assert.equal(parseVehicleResponse([]), undefined);
  });

  it("throws for anything that is not a list, such as a Socrata error object (#21)", () => {
    assert.throws(() => parseVehicleResponse({ error: true, message: "query failed" }), RdwResponseError);
  });

  it("returns undefined when the record has no plate", () => {
    assert.equal(parseVehicleResponse([{ merk: "TESTMERK" }]), undefined);
  });
});
