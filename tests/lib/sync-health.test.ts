import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SyncHealth } from "../../lib/sync-health";

describe("SyncHealth", () => {
  it("warns when the RDW no longer knows the vehicle (#15)", () => {
    assert.deepEqual(new SyncHealth().notFound(), { set: "device.warning.vehicle_not_found" });
  });

  it("warns once syncs have kept failing for a day (#20)", () => {
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

  it("clears a warning left from before a restart on the first successful sync (#15)", () => {
    assert.deepEqual(new SyncHealth().succeeded(), { clear: true });
  });

  it("measures the outage from the first failure after a success (#20)", () => {
    const health = new SyncHealth();
    health.failed(0);
    health.succeeded();
    assert.equal(health.failed(SyncHealth.UNREACHABLE_AFTER_MS), undefined);
  });

  it("does not warn about a short outage, however many retries it takes (#20)", () => {
    const health = new SyncHealth();
    const minute = 60_000;
    for (const at of [0, 1, 3, 7, 15, 31, 63].map((m) => m * minute)) assert.equal(health.failed(at), undefined);
  });

  it("keeps measuring an outage across app restarts (#32)", () => {
    const outageStart = 1_000_000;
    const afterRestart = new SyncHealth(outageStart);
    assert.deepEqual(afterRestart.failed(outageStart + SyncHealth.UNREACHABLE_AFTER_MS), {
      set: "device.warning.rdw_unreachable",
    });
  });

  it("starts the outage again when the clock jumped back (#32)", () => {
    const health = new SyncHealth(10 * SyncHealth.UNREACHABLE_AFTER_MS);
    assert.equal(health.failed(0), undefined);
    assert.equal(health.outageStart, 0);
  });

  it("says the RDW refused the request instead of calling it unreachable (#34)", () => {
    assert.deepEqual(new SyncHealth().rejected(), { set: "device.warning.rdw_rejected" });
  });

  it("does not count a refused request as part of an outage (#34)", () => {
    const health = new SyncHealth();
    health.failed(0);
    health.rejected();
    assert.equal(health.outageStart, undefined);
  });
});
