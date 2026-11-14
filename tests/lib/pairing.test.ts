import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pairedVehicle } from "../../lib/pairing";
import { vehicle } from "../helpers/fixtures";

describe("pairedVehicle", () => {
  it("names the device after brand and model and keys it on the plate", () => {
    assert.deepEqual(pairedVehicle(vehicle(), "AE01IO"), {
      name: "TESTMERK MODEL X",
      data: { id: "AE01IO" },
      settings: {},
      store: { license_plate: "AE01IO", apk_expiry_date: "20270115" },
    });
  });
});
