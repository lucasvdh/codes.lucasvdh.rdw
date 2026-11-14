import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isApkExpired, matchesUpcomingApk, planVehicleSync, type SyncEvent } from "../../lib/vehicle-sync";
import { vehicle } from "../helpers/fixtures";

const NOW = new Date("2026-06-01T12:00:00Z");
const TZ = "Europe/Amsterdam";
const SAME = { apkExpiryDate: "20270115", openRecall: "Nee", isInsured: "Ja" };

function types(events: SyncEvent[]): string[] {
  return events.map((e) => e.type);
}

describe("planVehicleSync", () => {
  it("maps the record to capability values", () => {
    assert.deepEqual(planVehicleSync(SAME, vehicle(), NOW, TZ).capabilities, {
      license_plate: "AE01IO",
      vehicle_type: "Personenauto",
      brand: "TESTMERK",
      trade_name: "MODEL X",
      is_insured: "Ja",
      apk_expiry_date: "2027-01-15",
      open_recall_indicator: "Nee",
    });
  });

  it("remembers the RDW values and the day of the check for the next sync", () => {
    assert.deepEqual(planVehicleSync({}, vehicle(), NOW, TZ).snapshot, { ...SAME, lastDailyCheck: "2026-06-01" });
  });

  it("only evaluates the upcoming-APK trigger when nothing changed", () => {
    assert.deepEqual(types(planVehicleSync(SAME, vehicle(), NOW, TZ).events), ["upcoming_apk_expiry_date"]);
  });

  it("fires the expiry-date-changed trigger with the new date", () => {
    const events = planVehicleSync({ ...SAME, apkExpiryDate: "20260115" }, vehicle(), NOW, TZ).events;
    assert.deepEqual(events.find((e) => e.type === "apk_expiry_date_changed"), {
      type: "apk_expiry_date_changed",
      newDate: "2027-01-15",
    });
  });

  it("fires the recall trigger when a recall opens", () => {
    const events = planVehicleSync(SAME, vehicle({ openstaande_terugroepactie_indicator: "Ja" }), NOW, TZ).events;
    assert.ok(types(events).includes("open_recall"));
  });

  it("does not fire the recall trigger when a recall closes", () => {
    const events = planVehicleSync({ ...SAME, openRecall: "Ja" }, vehicle(), NOW, TZ).events;
    assert.ok(!types(events).includes("open_recall"));
  });
});

describe("planVehicleSync: insurance and recall triggers", () => {
  it("fires insurance-has-expired when the insurance ends (Ja to Nee)", () => {
    const events = planVehicleSync(SAME, vehicle({ wam_verzekerd: "Nee" }), NOW, TZ).events;
    assert.ok(types(events).includes("insurance_has_expired"));
  });

  it("does not fire insurance-has-expired when the insurance starts (Nee to Ja)", () => {
    const events = planVehicleSync({ ...SAME, isInsured: "Nee" }, vehicle(), NOW, TZ).events;
    assert.ok(!types(events).includes("insurance_has_expired"));
  });

  it("does not fire change triggers on the first sync after pairing", () => {
    const firstSync = { apkExpiryDate: "20270115" };
    const uninsuredWithRecall = vehicle({ wam_verzekerd: "Nee", openstaande_terugroepactie_indicator: "Ja" });
    assert.deepEqual(types(planVehicleSync(firstSync, vehicle(), NOW, TZ).events), ["upcoming_apk_expiry_date"]);
    assert.deepEqual(types(planVehicleSync(firstSync, uninsuredWithRecall, NOW, TZ).events), ["upcoming_apk_expiry_date"]);
  });
});

describe("planVehicleSync: APK days and notifications", () => {
  const EXPIRY = { vervaldatum_apk: "20261120" };
  const daysUntilApk = (events: SyncEvent[]) =>
    events.flatMap((e) => (e.type === "upcoming_apk_expiry_date" ? [e.daysUntilApk] : []))[0];
  const notifications = (events: SyncEvent[]) => events.flatMap((e) => (e.type === "notification" ? [e.key] : []));
  const checkedOn = (day: string) => ({ ...SAME, apkExpiryDate: "20261120", lastDailyCheck: day });

  it("counts calendar days in Homey's timezone, late in the evening too", () => {
    const lateEvening = new Date("2026-11-14T22:30:00Z"); // 23:30 in Amsterdam
    assert.equal(daysUntilApk(planVehicleSync(SAME, vehicle(EXPIRY), lateEvening, TZ).events), 6);
  });

  it("sends 'has expired' on the expiry day", () => {
    const events = planVehicleSync(checkedOn("2026-11-19"), vehicle(EXPIRY), new Date("2026-11-20T09:00:00Z"), TZ).events;
    assert.deepEqual(notifications(events), ["messages.has_expired"]);
  });

  it("sends 'expires in a month' 30 calendar days before", () => {
    const events = planVehicleSync(checkedOn("2026-10-20"), vehicle(EXPIRY), new Date("2026-10-21T09:00:00Z"), TZ).events;
    assert.deepEqual(notifications(events), ["messages.expires_in_a_month"]);
  });

  it("still sends 'expires in a month' when the 30th day was missed", () => {
    const events = planVehicleSync(checkedOn("2026-10-19"), vehicle(EXPIRY), new Date("2026-10-22T09:00:00Z"), TZ).events;
    assert.deepEqual(notifications(events), ["messages.expires_in_a_month"]);
  });

  it("evaluates the daily triggers and notifications once per day, also after a restart", () => {
    const events = planVehicleSync(checkedOn("2026-11-20"), vehicle(EXPIRY), new Date("2026-11-20T15:00:00Z"), TZ).events;
    assert.deepEqual(events, []);
  });

  it("does not announce a month to go for a vehicle paired 10 days before its APK", () => {
    const events = planVehicleSync({ apkExpiryDate: "20261120" }, vehicle(EXPIRY), new Date("2026-11-10T09:00:00Z"), TZ).events;
    assert.deepEqual(notifications(events), []);
  });
});

describe("isApkExpired", () => {
  it("is not expired late on the day before the expiry date", () => {
    assert.equal(isApkExpired("20261120", new Date("2026-11-19T22:30:00Z"), TZ), false);
  });

  it("is expired on the expiry date", () => {
    assert.equal(isApkExpired("20261120", new Date("2026-11-20T09:00:00Z"), TZ), true);
  });
});

describe("matchesUpcomingApk", () => {
  it("matches when the APK expires within the Flow's number of days", () => {
    assert.equal(matchesUpcomingApk(7, 7), true);
    assert.equal(matchesUpcomingApk(7, 3), true);
    assert.equal(matchesUpcomingApk(7, 8), false);
  });
});
