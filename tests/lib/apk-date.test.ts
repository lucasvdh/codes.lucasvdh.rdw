import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calendarDateIn, daysBetween, isoDate, parseIsoDate, parseRdwDate } from "../../lib/apk-date";

describe("parseRdwDate", () => {
  it("reads yyyymmdd", () => {
    assert.deepEqual(parseRdwDate("20270115"), { year: 2027, month: 1, day: 15 });
  });

  it("rejects anything else", () => {
    for (const input of ["", "2027-01-15", "2027011", "abcdefgh"]) assert.equal(parseRdwDate(input), undefined);
  });
});

describe("isoDate / parseIsoDate", () => {
  it("round-trips", () => {
    assert.equal(isoDate({ year: 2027, month: 1, day: 5 }), "2027-01-05");
    assert.deepEqual(parseIsoDate("2027-01-05"), { year: 2027, month: 1, day: 5 });
  });
});

describe("calendarDateIn", () => {
  it("uses the given timezone, not the process timezone", () => {
    const instant = new Date("2026-12-31T23:30:00Z");
    assert.deepEqual(calendarDateIn("Europe/Amsterdam", instant), { year: 2027, month: 1, day: 1 });
    assert.deepEqual(calendarDateIn("UTC", instant), { year: 2026, month: 12, day: 31 });
  });
});

describe("daysBetween", () => {
  it("counts whole days across a DST change and a year boundary", () => {
    assert.equal(daysBetween({ year: 2026, month: 10, day: 24 }, { year: 2026, month: 10, day: 26 }), 2);
    assert.equal(daysBetween({ year: 2026, month: 12, day: 31 }, { year: 2027, month: 1, day: 1 }), 1);
    assert.equal(daysBetween({ year: 2027, month: 1, day: 1 }, { year: 2026, month: 12, day: 31 }), -1);
  });
});
