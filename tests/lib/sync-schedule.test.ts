import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PollLoop } from "../../lib/poll-loop";
import { SYNC_SCHEDULE } from "../../lib/sync-schedule";
import { FakeTimers } from "../helpers/fake-timers";

const DAY_MS = 24 * 60 * 60 * 1000;
const SYNC_DURATION_MS = 15_000;

describe("SYNC_SCHEDULE", () => {
  it("checks every calendar day, also when each sync takes time and the jitter pushes it later (#19)", async () => {
    const timers = new FakeTimers();
    timers.now = DAY_MS - 10_000; // the first sync starts 10 s before midnight
    const daysWithSync = new Set<number>();
    const sync = async () => {
      daysWithSync.add(Math.floor(timers.now / DAY_MS));
      timers.now += SYNC_DURATION_MS;
    };
    new PollLoop(sync, { ...SYNC_SCHEDULE, startSpreadMs: 0, timers, log: () => {}, random: () => 1 }).start();
    await timers.advance(30 * DAY_MS);

    const firstDay = Math.min(...daysWithSync);
    const lastDay = Math.max(...daysWithSync);
    const missed = [];
    for (let day = firstDay; day <= lastDay; day++) if (!daysWithSync.has(day)) missed.push(day);
    assert.deepEqual(missed, []);
  });

  it("asks the RDW about once a day per vehicle (#35)", async () => {
    const timers = new FakeTimers();
    let syncs = 0;
    const sync = async () => { syncs++; };
    new PollLoop(sync, { ...SYNC_SCHEDULE, startSpreadMs: 0, timers, log: () => {}, random: () => 0 }).start();
    await timers.advance(30 * DAY_MS);

    assert.ok(syncs <= 33, `${syncs} syncs in 30 days`);
  });
});
