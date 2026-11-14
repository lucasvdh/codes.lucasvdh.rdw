import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applySyncPlan } from "../../lib/apply-sync";
import { planVehicleSync } from "../../lib/vehicle-sync";
import { vehicle } from "../helpers/fixtures";

describe("applySyncPlan", () => {
  it("saves the new values before firing triggers, so conditions in the same Flow see them", async () => {
    const steps: string[] = [];
    const renewed = planVehicleSync(
      { apkExpiryDate: "20260101", openRecall: "Nee", isInsured: "Ja", lastDailyCheck: "2026-05-31" },
      vehicle({ vervaldatum_apk: "20270101" }),
      new Date("2026-06-01T12:00:00Z"),
      "Europe/Amsterdam",
    );

    await applySyncPlan(renewed, {
      setCapability: async (id) => { steps.push(`capability:${id}`); },
      saveSnapshot: async () => { steps.push("snapshot"); },
      fire: async (event) => { steps.push(`fire:${event.type}`); },
    });

    const firstFire = steps.findIndex((s) => s.startsWith("fire:"));
    const lastWrite = Math.max(...steps.map((s, i) => (s.startsWith("fire:") ? -1 : i)));
    assert.ok(steps.includes("fire:apk_expiry_date_changed"));
    assert.ok(lastWrite < firstFire, steps.join(", "));
  });

  it("stops writing and firing as soon as the sync is no longer current (vehicle deleted mid-sync)", async () => {
    const steps: string[] = [];
    let current = true;
    const plan = planVehicleSync({}, vehicle(), new Date("2026-06-01T12:00:00Z"), "Europe/Amsterdam");

    await applySyncPlan(
      plan,
      {
        setCapability: async (id) => {
          steps.push(`capability:${id}`);
          current = false;
        },
        saveSnapshot: async () => { steps.push("snapshot"); },
        fire: async (event) => { steps.push(`fire:${event.type}`); },
      },
      () => current,
    );

    assert.deepEqual(steps, ["capability:license_plate"]);
  });
});
