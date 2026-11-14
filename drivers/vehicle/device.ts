import Homey from "homey";
import { PollLoop } from "../../lib/poll-loop";
import { RdwClient } from "../../lib/rdw-client";
import { planVehicleSync, STORE, type CapabilityValues, type VehicleSnapshot } from "../../lib/vehicle-sync";
import type { VehicleDriver } from "./driver";

const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;
const ADDED_IN_0_2_0 = ["open_recall_indicator"];

class VehicleDevice extends Homey.Device {
  private readonly client = new RdwClient();
  private loop?: PollLoop;

  async onInit(): Promise<void> {
    await this.migrate();
    this.loop = new PollLoop(() => this.sync(), {
      intervalMs: SYNC_INTERVAL_MS,
      timers: this.homey,
      log: (...args) => this.error(...args),
    });
    this.loop.start();
    await this.setAvailable().catch(this.error);
  }

  async onUninit(): Promise<void> {
    this.loop?.stop();
  }

  private async migrate(): Promise<void> {
    for (const capability of ADDED_IN_0_2_0) {
      if (!this.hasCapability(capability)) await this.addCapability(capability).catch(this.error);
    }
  }

  private async sync(): Promise<void> {
    this.log("[sync] fetching vehicle data from RDW");
    const vehicle = await this.client.fetchVehicle(this.getStoreValue(STORE.LICENSE_PLATE) as string);
    if (vehicle === undefined) throw new Error("Vehicle not found");

    const plan = planVehicleSync(this.snapshot(), vehicle, new Date());
    await this.setCapabilities(plan.capabilities);

    const driver = this.driver as VehicleDriver;
    for (const event of plan.events) {
      await driver.fire(this, event).catch((err) => this.error(`[sync] ${event.type} failed`, err));
    }

    await this.setStoreValue(STORE.APK_EXPIRY_DATE, plan.snapshot.apkExpiryDate).catch(this.error);
    await this.setStoreValue(STORE.OPEN_RECALL, plan.snapshot.openRecall).catch(this.error);
    await this.setStoreValue(STORE.IS_INSURED, plan.snapshot.isInsured).catch(this.error);
  }

  private snapshot(): VehicleSnapshot {
    return {
      apkExpiryDate: this.getStoreValue(STORE.APK_EXPIRY_DATE) as string | undefined,
      openRecall: this.getStoreValue(STORE.OPEN_RECALL) as string | undefined,
      isInsured: this.getStoreValue(STORE.IS_INSURED) as string | undefined,
    };
  }

  private async setCapabilities(values: CapabilityValues): Promise<void> {
    for (const [capability, value] of Object.entries(values)) {
      await this.setCapabilityValue(capability, value).catch(this.error);
    }
  }
}

module.exports = VehicleDevice;
