import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeLicensePlate } from "../../lib/license-plate";

describe("normalizeLicensePlate", () => {
  it("accepts plates typed with dashes, spaces and lower case (forum t/92575 post 3)", () => {
    assert.equal(normalizeLicensePlate("ae-01-io"), "AE01IO");
    assert.equal(normalizeLicensePlate(" AE 01 IO "), "AE01IO");
  });

  it("returns undefined when nothing usable is left", () => {
    assert.equal(normalizeLicensePlate(""), undefined);
    assert.equal(normalizeLicensePlate(" - "), undefined);
    assert.equal(normalizeLicensePlate(null), undefined);
    assert.equal(normalizeLicensePlate(42), undefined);
  });

  it("rejects input longer than any plate", () => {
    assert.equal(normalizeLicensePlate("AE01IOAE01IOAE01IO"), undefined);
  });
});
