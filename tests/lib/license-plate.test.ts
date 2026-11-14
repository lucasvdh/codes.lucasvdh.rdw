import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkLicensePlate, normalizeLicensePlate } from "../../lib/license-plate";

describe("normalizeLicensePlate", () => {
  it("accepts plates typed with dashes, spaces and lower case (forum t/92575 post 3)", () => {
    assert.equal(normalizeLicensePlate("ae-01-io"), "AE01IO");
    assert.equal(normalizeLicensePlate(" AE 01 IO "), "AE01IO");
  });

  it("returns undefined when nothing usable is left (#11)", () => {
    assert.equal(normalizeLicensePlate(""), undefined);
    assert.equal(normalizeLicensePlate(" - "), undefined);
    assert.equal(normalizeLicensePlate(null), undefined);
    assert.equal(normalizeLicensePlate(42), undefined);
  });

  it("rejects input longer than any plate (#11)", () => {
    assert.equal(normalizeLicensePlate("AE01IOAE01IOAE01IO"), undefined);
  });
});

describe("checkLicensePlate", () => {
  it("returns the normalized plate", () => {
    assert.deepEqual(checkLicensePlate("ae-01-io"), { plate: "AE01IO" });
  });

  it("asks for a plate when nothing was entered", () => {
    assert.deepEqual(checkLicensePlate(""), { error: "error.license_plate_missing" });
    assert.deepEqual(checkLicensePlate(" - "), { error: "error.license_plate_missing" });
    assert.deepEqual(checkLicensePlate(undefined), { error: "error.license_plate_missing" });
  });

  it("says the plate is not valid when it is too long (#23)", () => {
    assert.deepEqual(checkLicensePlate("AE01IOAE01IO"), { error: "error.license_plate_invalid" });
  });
});
