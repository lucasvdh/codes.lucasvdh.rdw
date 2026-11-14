import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PollLoop, type PollRun } from "../../lib/poll-loop";
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

  it("doubles the retry delay per failure up to the maximum", async () => {
    const timers = new FakeTimers();
    const { task } = failingThenOk(10);
    const options = { intervalMs: DAY_MS, timers, log: () => {}, retryBaseMs: 1000, retryMaxMs: 8000, random: () => 1 };
    new PollLoop(task, options).start();

    const delays: number[] = [];
    await timers.advance(0);
    for (let i = 0; i < 5; i++) {
      delays.push(timers.delays()[0]);
      await timers.advance(timers.delays()[0]);
    }
    assert.deepEqual(delays, [1000, 2000, 4000, 8000, 8000]);
  });

  it("goes back to the daily interval after a successful retry", async () => {
    const timers = new FakeTimers();
    const { task, calls } = failingThenOk(2);
    new PollLoop(task, { intervalMs: DAY_MS, timers, log: () => {}, random: () => 1 }).start();
    await timers.advance(0);
    await timers.advance(timers.delays()[0]);
    await timers.advance(timers.delays()[0]);

    assert.equal(calls(), 3);
    assert.deepEqual(timers.delays(), [DAY_MS]);
  });

  it("waits at least as long as a Retry-After asks", async () => {
    const timers = new FakeTimers();
    const rateLimited = async () => {
      throw Object.assign(new Error("429"), { retryAfterMs: 2 * HOUR_MS });
    };
    new PollLoop(rateLimited, { intervalMs: DAY_MS, timers, log: () => {} }).start();
    await timers.advance(0);

    assert.deepEqual(timers.delays(), [2 * HOUR_MS]);
  });

  it("never waits longer than the interval, whatever Retry-After says", async () => {
    const timers = new FakeTimers();
    const rateLimited = async () => {
      throw Object.assign(new Error("503"), { retryAfterMs: 365 * DAY_MS });
    };
    new PollLoop(rateLimited, { intervalMs: DAY_MS, timers, log: () => {} }).start();
    await timers.advance(0);

    assert.deepEqual(timers.delays(), [DAY_MS]);
  });

  it("waits for the next interval after a failure that a retry won't fix", async () => {
    const timers = new FakeTimers();
    const badRequest = async () => {
      throw Object.assign(new Error("400"), { retryable: false });
    };
    new PollLoop(badRequest, { intervalMs: DAY_MS, timers, log: () => {} }).start();
    await timers.advance(0);

    assert.deepEqual(timers.delays(), [DAY_MS]);
  });

  it("starts the backoff from the beginning after permanent failures", async () => {
    const timers = new FakeTimers();
    const errors = [{ retryable: false }, { retryable: false }, {}];
    const task = async () => {
      throw Object.assign(new Error("failed"), errors.shift() ?? {});
    };
    new PollLoop(task, { intervalMs: DAY_MS, timers, log: () => {}, retryBaseMs: 1000, random: () => 1 }).start();
    await timers.advance(0);
    await timers.advance(DAY_MS);
    await timers.advance(DAY_MS);

    assert.deepEqual(timers.delays(), [1000]);
  });

  it("spreads the first run over the start window", async () => {
    const timers = new FakeTimers();
    const { task } = failingThenOk(0);
    new PollLoop(task, { intervalMs: DAY_MS, timers, log: () => {}, startSpreadMs: 60_000, random: () => 0.5 }).start();

    assert.deepEqual(timers.delays(), [30_000]);
  });

  it("does not reschedule when stopped while a run is in flight", async () => {
    const timers = new FakeTimers();
    let finish: () => void = () => {};
    const slow = () => new Promise<void>((resolve) => { finish = resolve; });
    const loop = new PollLoop(slow, { intervalMs: DAY_MS, timers, log: () => {} });
    loop.start();
    await timers.advance(0);

    loop.stop();
    finish();
    await flush();
    assert.deepEqual(timers.delays(), []);
  });

  it("tells a running task once the loop has stopped", async () => {
    const timers = new FakeTimers();
    let finish: () => void = () => {};
    let currentAfterStop: boolean | undefined;
    const slow = async (run: PollRun) => {
      await new Promise<void>((resolve) => { finish = resolve; });
      currentAfterStop = run.isCurrent();
    };
    const loop = new PollLoop(slow, { intervalMs: DAY_MS, timers, log: () => {} });
    loop.start();
    await timers.advance(0);

    loop.stop();
    finish();
    await flush();
    assert.equal(currentAfterStop, false);
  });

  it("never overlaps runs", async () => {
    const timers = new FakeTimers();
    let running = 0;
    let maxRunning = 0;
    const task = async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await flush();
      running--;
    };
    new PollLoop(task, { intervalMs: 10, timers, log: () => {} }).start();
    await timers.advance(100);

    assert.equal(maxRunning, 1);
  });
});
