import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PollLoop } from "../../lib/poll-loop";
import { FakeTimers, flush } from "../helpers/fake-timers";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function failingThenOk(failures: number): { task: () => Promise<void>; calls: () => number } {
  let calls = 0;
  return {
    task: async () => {
      calls++;
      if (calls <= failures) throw new Error("RDW unreachable");
    },
    calls: () => calls,
  };
}

describe("PollLoop", () => {
  it("retries a failed sync within the hour instead of the next day", async () => {
    const timers = new FakeTimers();
    const { task } = failingThenOk(1);
    new PollLoop(task, { intervalMs: DAY_MS, timers, log: () => {} }).start();
    await timers.advance(0);
    await flush();

    assert.equal(timers.delays().length, 1);
    assert.ok(timers.delays()[0] <= HOUR_MS, `next run in ${timers.delays()[0]} ms`);
  });
});
