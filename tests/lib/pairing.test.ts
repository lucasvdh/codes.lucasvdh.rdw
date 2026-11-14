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

  it("names a vehicle without a model after its brand, and one without either after its plate (#14)", () => {
    assert.equal(pairedVehicle(vehicle({ handelsbenaming: "" }), "AE01IO").name, "TESTMERK");
    assert.equal(pairedVehicle(vehicle({ merk: "", handelsbenaming: "" }), "AE01IO").name, "AE01IO");
  });
});
