import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatApkDate } from "../../lib/apk-date";

describe("formatApkDate", () => {
  it("turns an RDW date into an ISO date", () => {
    assert.equal(formatApkDate("20270115"), "2027-01-15");
  });
});
