import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SyncHealth } from "../../lib/sync-health";

describe("SyncHealth", () => {
  it("warns when the RDW no longer knows the vehicle", () => {
    assert.deepEqual(new SyncHealth().notFound(), { set: "device.warning.vehicle_not_found" });
  });

  it("warns only after several failed syncs in a row", () => {
    const health = new SyncHealth();
    for (let i = 1; i < SyncHealth.FAILURES_BEFORE_WARNING; i++) assert.equal(health.failed(), undefined);
    assert.deepEqual(health.failed(), { set: "device.warning.rdw_unreachable" });
  });

  it("clears the warning after a successful sync, once", () => {
    const health = new SyncHealth();
    health.notFound();
    assert.deepEqual(health.succeeded(), { clear: true });
    assert.equal(health.succeeded(), undefined);
  });

  it("changes nothing while the state stays the same", () => {
    const health = new SyncHealth();
    health.notFound();
    assert.equal(health.notFound(), undefined);
  });

  it("clears a warning left from before a restart on the first successful sync", () => {
    assert.deepEqual(new SyncHealth().succeeded(), { clear: true });
  });

  it("starts counting failures again after a success", () => {
    const health = new SyncHealth();
    for (let i = 1; i < SyncHealth.FAILURES_BEFORE_WARNING; i++) health.failed();
    health.succeeded();
    assert.equal(health.failed(), undefined);
  });

  it("does not warn about a short outage, however many retries it takes", () => {
    const health = new SyncHealth();
    const minute = 60_000;
    for (const at of [0, 1, 3, 7, 15, 31, 63].map((m) => m * minute)) assert.equal(health.failed(at), undefined);
  });
});
