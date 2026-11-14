import http from "http";
import https from "https";
import { RdwHttpError, RdwResponseError } from "./errors";
import { parseVehicleResponse, type VehicleRecord } from "./vehicle";

export const RDW_BASE_URL = "https://opendata.rdw.nl";
const VEHICLES_PATH = "/api/id/m9d7-ebf2.json";

export interface RdwClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
}

export class RdwClient {
  private readonly baseUrl: string;

  constructor(options: RdwClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? RDW_BASE_URL;
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
        res.on("error", reject);
        res.on("end", () => {
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
      req.on("error", reject);
    });
  }
}
