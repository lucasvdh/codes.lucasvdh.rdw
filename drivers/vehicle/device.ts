import Homey from "homey";
import { PollLoop } from "../../lib/poll-loop";
import { RdwClient } from "../../lib/rdw-client";
import { SyncHealth, type WarningChange } from "../../lib/sync-health";
import { applySyncPlan } from "../../lib/apply-sync";
import { planVehicleSync, STORE, type VehicleSnapshot } from "../../lib/vehicle-sync";
import type { VehicleRecord } from "../../lib/vehicle";
import type { VehicleDriver } from "./driver";

const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;
const START_SPREAD_MS = 5 * 60 * 1000;
const ADDED_IN_0_2_0 = ["open_recall_indicator"];

class VehicleDevice extends Homey.Device {
  private readonly client = new RdwClient();
  private loop?: PollLoop;
  private readonly health = new SyncHealth();

  async onInit(): Promise<void> {
    await this.migrate();
    this.loop = new PollLoop(() => this.sync(), {
      intervalMs: SYNC_INTERVAL_MS,
      startSpreadMs: START_SPREAD_MS,
      timers: this.homey,
      log: (...args) => this.error(...args),
    });
    this.loop.start();
    await this.setAvailable().catch(this.error);
  }

  async onUninit(): Promise<void> {
    this.teardown();
  }

  async onDeleted(): Promise<void> {
    this.teardown();
  }

  private teardown(): void {
    this.loop?.stop();
  }

  private async migrate(): Promise<void> {
    for (const capability of ADDED_IN_0_2_0) {
      if (!this.hasCapability(capability)) await this.addCapability(capability).catch(this.error);
    }
  }

  private async sync(): Promise<void> {
    this.log("[sync] fetching vehicle data from RDW");
    let vehicle: VehicleRecord | undefined;
    try {
      vehicle = await this.client.fetchVehicle(this.getStoreValue(STORE.LICENSE_PLATE) as string);
    } catch (err) {
      await this.applyWarning(this.health.failed());
      throw err;
    }
    if (vehicle === undefined) {
      this.log("[sync] the RDW has no vehicle for this plate");
      await this.applyWarning(this.health.notFound());
      return;
    }
    await this.applyWarning(this.health.succeeded());

    const plan = planVehicleSync(this.snapshot(), vehicle, new Date(), this.homey.clock.getTimezone());
    const driver = this.driver as VehicleDriver;
    await applySyncPlan(plan, {
      setCapability: (id, value) => this.setCapabilityValue(id, value).catch(this.error),
      fire: (event) => driver.fire(this, event).catch((err) => this.error(`[sync] ${event.type} failed`, err)),
      saveSnapshot: async (snapshot) => {
        await this.setStoreValue(STORE.APK_EXPIRY_DATE, snapshot.apkExpiryDate).catch(this.error);
        await this.setStoreValue(STORE.OPEN_RECALL, snapshot.openRecall).catch(this.error);
        await this.setStoreValue(STORE.IS_INSURED, snapshot.isInsured).catch(this.error);
        await this.setStoreValue(STORE.LAST_DAILY_CHECK, snapshot.lastDailyCheck).catch(this.error);
      },
    });
  }

  private async applyWarning(change: WarningChange): Promise<void> {
    if (change === undefined) return;
    if ("set" in change) await this.setWarning(this.homey.__(change.set)).catch(this.error);
    else await this.unsetWarning().catch(this.error);
  }

  private snapshot(): VehicleSnapshot {
    return {
      apkExpiryDate: this.getStoreValue(STORE.APK_EXPIRY_DATE) as string | undefined,
      openRecall: this.getStoreValue(STORE.OPEN_RECALL) as string | undefined,
      isInsured: this.getStoreValue(STORE.IS_INSURED) as string | undefined,
      lastDailyCheck: this.getStoreValue(STORE.LAST_DAILY_CHECK) as string | undefined,
    };
  }
}

module.exports = VehicleDevice;
