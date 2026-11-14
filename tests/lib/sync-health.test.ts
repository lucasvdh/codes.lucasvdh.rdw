import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SyncHealth } from "../../lib/sync-health";

describe("SyncHealth", () => {
  it("warns when the RDW no longer knows the vehicle", () => {
    assert.deepEqual(new SyncHealth().notFound(), { set: "device.warning.vehicle_not_found" });
  });

  it("warns once syncs have kept failing for a day", () => {
    const health = new SyncHealth();
    assert.equal(health.failed(0), undefined);
    assert.equal(health.failed(SyncHealth.UNREACHABLE_AFTER_MS - 1), undefined);
    assert.deepEqual(health.failed(SyncHealth.UNREACHABLE_AFTER_MS), { set: "device.warning.rdw_unreachable" });
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

  it("measures the outage from the first failure after a success", () => {
    const health = new SyncHealth();
    health.failed(0);
    health.succeeded();
    assert.equal(health.failed(SyncHealth.UNREACHABLE_AFTER_MS), undefined);
  });

  it("does not warn about a short outage, however many retries it takes", () => {
    const health = new SyncHealth();
    const minute = 60_000;
    for (const at of [0, 1, 3, 7, 15, 31, 63].map((m) => m * minute)) assert.equal(health.failed(at), undefined);
  });
});
