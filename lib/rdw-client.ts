import http from "http";
import https from "https";
import { RdwHttpError, RdwResponseError, RdwTimeoutError } from "./errors";
import { parseVehicleResponse, type VehicleRecord } from "./vehicle";

export const RDW_BASE_URL = "https://opendata.rdw.nl";
const VEHICLES_PATH = "/api/id/m9d7-ebf2.json";
const DEFAULT_TIMEOUT_MS = 15_000;

export interface RdwClientOptions {
  baseUrl?: string;
  /** Deadline for the whole request, from connecting to the last byte. */
  timeoutMs?: number;
}

export class RdwClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: RdwClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? RDW_BASE_URL;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async fetchVehicle(licensePlate: string): Promise<VehicleRecord | undefined> {
    const where = `(UPPER(kenteken)=UPPER(%27${encodeURIComponent(licensePlate)}%27))`;
    const body = await this.getJson(`${this.baseUrl}${VEHICLES_PATH}?$where=${where}`);
    return parseVehicleResponse(body);
  }

  private getJson(url: string): Promise<unknown> {
    const transport = url.startsWith("https:") ? https : http;
    return new Promise((resolve, reject) => {
      const req = transport.get(url, { headers: { accept: "application/json" } }, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("error", fail);
        res.on("end", () => {
          clearTimeout(deadline);
          const status = res.statusCode ?? 0;
          if (status < 200 || status >= 300) {
            reject(new RdwHttpError(status));
            return;
          }
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch (err) {
            reject(new RdwResponseError("RDW response is not JSON", { cause: err }));
          }
        });
      });
      const deadline = setTimeout(() => req.destroy(new RdwTimeoutError(this.timeoutMs)), this.timeoutMs);
      function fail(err: Error): void {
        clearTimeout(deadline);
        reject(err);
      }
      req.on("error", fail);
    });
  }
}
