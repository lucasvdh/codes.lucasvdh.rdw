import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { errorMessageKey } from "../../lib/error-messages";
import { RdwHttpError, RdwResponseError } from "../../lib/errors";

describe("errorMessageKey", () => {
  it("blames the RDW for HTTP and response errors", () => {
    assert.equal(errorMessageKey(new RdwHttpError(503)), "error.rdw_unavailable");
    assert.equal(errorMessageKey(new RdwResponseError("not json")), "error.rdw_unavailable");
  });

  it("blames the RDW for network errors", () => {
    const err = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });
    assert.equal(errorMessageKey(err), "error.rdw_unavailable");
  });

  it("falls back to a generic message for anything else", () => {
    assert.equal(errorMessageKey(new TypeError("boom")), "error.generic");
    assert.equal(errorMessageKey("boom"), "error.generic");
  });
});
