import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { RdwHttpError, RdwRateLimitError, RdwResponseError, RdwTimeoutError } from "../../lib/errors";
import { RdwClient } from "../../lib/rdw-client";
import { fakeServer, json, type FakeServer } from "../helpers/fake-server";
import { vehicleResponse } from "../helpers/fixtures";

describe("RdwClient.fetchVehicle", () => {
  let server: FakeServer | undefined;
  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it("queries the vehicles dataset by plate and returns the vehicle", async () => {
    server = await fakeServer(() => json(vehicleResponse()));
    const vehicle = await new RdwClient({ baseUrl: server.url }).fetchVehicle("AE01IO");

    assert.equal(vehicle?.kenteken, "AE01IO");
    assert.deepEqual(server.requests, ["/api/id/m9d7-ebf2.json?$where=(UPPER(kenteken)=UPPER(%27AE01IO%27))"]);
  });

  it("queries the normalized plate, so a legacy stored value can't break the query", async () => {
    server = await fakeServer(() => json([]));
    await new RdwClient({ baseUrl: server.url }).fetchVehicle("ae-01'io)");
    assert.deepEqual(server.requests, ["/api/id/m9d7-ebf2.json?$where=(UPPER(kenteken)=UPPER(%27AE01IO%27))"]);
  });

  it("marks client errors as permanent and server errors as worth a retry", () => {
    assert.equal(new RdwHttpError(400).retryable, false);
    assert.equal(new RdwHttpError(404).retryable, false);
    assert.equal(new RdwHttpError(408).retryable, true);
    assert.equal(new RdwHttpError(500).retryable, true);
  });

  it("returns undefined for an unknown plate", async () => {
    server = await fakeServer(() => json([]));
    assert.equal(await new RdwClient({ baseUrl: server.url }).fetchVehicle("AE01IO"), undefined);
  });

  it("throws RdwHttpError on a 4xx answer", async () => {
    server = await fakeServer(() => json({ error: true }, 400));
    await assert.rejects(new RdwClient({ baseUrl: server.url }).fetchVehicle("AE01IO"), (err: unknown) =>
      err instanceof RdwHttpError && err.statusCode === 400);
  });

  it("throws RdwResponseError for a JSON answer that is not a list of vehicles", async () => {
    server = await fakeServer(() => json({ error: true, message: "Service temporarily unavailable" }));
    await assert.rejects(new RdwClient({ baseUrl: server.url }).fetchVehicle("AE01IO"), RdwResponseError);
  });

  it("throws RdwResponseError when the body is not JSON", async () => {
    server = await fakeServer(() => ({ status: 200, body: "<html>maintenance</html>" }));
    await assert.rejects(new RdwClient({ baseUrl: server.url }).fetchVehicle("AE01IO"), RdwResponseError);
  });

  it("gives up on a request RDW never answers", async () => {
    server = await fakeServer(() => "hang");
    await assert.rejects(new RdwClient({ baseUrl: server.url, timeoutMs: 50 }).fetchVehicle("AE01IO"), RdwTimeoutError);
  });

  it("gives up on a response that stops halfway", async () => {
    server = await fakeServer(() => "stall");
    await assert.rejects(new RdwClient({ baseUrl: server.url, timeoutMs: 50 }).fetchVehicle("AE01IO"), RdwTimeoutError);
  });

  it("reports how long to wait when RDW throttles with Retry-After in seconds", async () => {
    server = await fakeServer(() => ({ status: 429, headers: { "retry-after": "120" } }));
    await assert.rejects(new RdwClient({ baseUrl: server.url }).fetchVehicle("AE01IO"), (err: unknown) =>
      err instanceof RdwRateLimitError && err.retryAfterMs === 120_000);
  });

  it("reads a Retry-After date on a 503", async () => {
    const now = Date.parse("2026-06-01T12:00:00Z");
    server = await fakeServer(() => ({ status: 503, headers: { "retry-after": "Mon, 01 Jun 2026 12:05:00 GMT" } }));
    await assert.rejects(new RdwClient({ baseUrl: server.url, now: () => now }).fetchVehicle("AE01IO"), (err: unknown) =>
      err instanceof RdwRateLimitError && err.retryAfterMs === 300_000);
  });

  it("throttles without a usable Retry-After", async () => {
    server = await fakeServer(() => ({ status: 429, headers: { "retry-after": "soon" } }));
    await assert.rejects(new RdwClient({ baseUrl: server.url }).fetchVehicle("AE01IO"), (err: unknown) =>
      err instanceof RdwRateLimitError && err.retryAfterMs === undefined);
  });
});
