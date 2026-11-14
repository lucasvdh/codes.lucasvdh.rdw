import http from "http";
import https from "https";
import { RdwHttpError, RdwRateLimitError, RdwResponseError, RdwTimeoutError } from "./errors";
import { parseVehicleResponse, type VehicleRecord } from "./vehicle";

export const RDW_BASE_URL = "https://opendata.rdw.nl";
const VEHICLES_PATH = "/api/id/m9d7-ebf2.json";
const DEFAULT_TIMEOUT_MS = 15_000;
const THROTTLED_STATUSES = [429, 503];

/** Retry-After is either delay-seconds or an HTTP date. */
export function parseRetryAfter(header: string | undefined, now: number): number | undefined {
  if (!header) return undefined;
  if (/^\d+$/.test(header.trim())) return Number(header.trim()) * 1000;
  const at = Date.parse(header);
  return Number.isNaN(at) ? undefined : Math.max(0, at - now);
}

export interface RdwClientOptions {
  baseUrl?: string;
  /** Deadline for the whole request, from connecting to the last byte. */
  timeoutMs?: number;
  now?: () => number;
}

export class RdwClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly now: () => number;

  constructor(options: RdwClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? RDW_BASE_URL;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.now = options.now ?? Date.now;
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
          if (THROTTLED_STATUSES.includes(status)) {
            reject(new RdwRateLimitError(status, parseRetryAfter(res.headers["retry-after"], this.now())));
            return;
          }
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
