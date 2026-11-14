import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { RdwHttpError, RdwResponseError } from "../../lib/errors";
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

  it("returns undefined for an unknown plate", async () => {
    server = await fakeServer(() => json([]));
    assert.equal(await new RdwClient({ baseUrl: server.url }).fetchVehicle("AE01IO"), undefined);
  });

  it("throws RdwHttpError on a 4xx answer", async () => {
    server = await fakeServer(() => json({ error: true }, 400));
    await assert.rejects(new RdwClient({ baseUrl: server.url }).fetchVehicle("AE01IO"), (err: unknown) =>
      err instanceof RdwHttpError && err.statusCode === 400);
  });

  it("throws RdwResponseError when the body is not JSON", async () => {
    server = await fakeServer(() => ({ status: 200, body: "<html>maintenance</html>" }));
    await assert.rejects(new RdwClient({ baseUrl: server.url }).fetchVehicle("AE01IO"), RdwResponseError);
  });
});
