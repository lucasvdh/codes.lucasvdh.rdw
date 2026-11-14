import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchesUpcomingApk, planVehicleSync, type SyncEvent } from "../../lib/vehicle-sync";
import { vehicle } from "../helpers/fixtures";

const NOW = new Date("2026-06-01T12:00:00Z");
const SAME = { apkExpiryDate: "20270115", openRecall: "Nee", isInsured: "Ja" };

function types(events: SyncEvent[]): string[] {
  return events.map((e) => e.type);
}

describe("planVehicleSync", () => {
  it("maps the record to capability values", () => {
    assert.deepEqual(planVehicleSync(SAME, vehicle(), NOW).capabilities, {
      license_plate: "AE01IO",
      vehicle_type: "Personenauto",
      brand: "TESTMERK",
      trade_name: "MODEL X",
      is_insured: "Ja",
      apk_expiry_date: "2027-01-15",
      open_recall_indicator: "Nee",
    });
  });

  it("remembers the RDW values for the next sync", () => {
    assert.deepEqual(planVehicleSync({}, vehicle(), NOW).snapshot, SAME);
  });

  it("only evaluates the upcoming-APK trigger when nothing changed", () => {
    assert.deepEqual(types(planVehicleSync(SAME, vehicle(), NOW).events), ["upcoming_apk_expiry_date"]);
  });

  it("fires the expiry-date-changed trigger with the new date", () => {
    const events = planVehicleSync({ ...SAME, apkExpiryDate: "20260115" }, vehicle(), NOW).events;
    assert.deepEqual(events.find((e) => e.type === "apk_expiry_date_changed"), {
      type: "apk_expiry_date_changed",
      newDate: "2027-01-15",
    });
  });

  it("fires the recall trigger when a recall opens", () => {
    const events = planVehicleSync(SAME, vehicle({ openstaande_terugroepactie_indicator: "Ja" }), NOW).events;
    assert.ok(types(events).includes("open_recall"));
  });

  it("does not fire the recall trigger when a recall closes", () => {
    const events = planVehicleSync({ ...SAME, openRecall: "Ja" }, vehicle(), NOW).events;
    assert.ok(!types(events).includes("open_recall"));
  });
});

describe("matchesUpcomingApk", () => {
  it("matches when the APK expires within the Flow's number of days", () => {
    assert.equal(matchesUpcomingApk(7, 7), true);
    assert.equal(matchesUpcomingApk(7, 3), true);
    assert.equal(matchesUpcomingApk(7, 8), false);
  });
});
