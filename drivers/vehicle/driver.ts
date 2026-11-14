import Homey from "homey";
import type PairSession from "homey/lib/PairSession";
import { errorMessageKey } from "../../lib/error-messages";
import { normalizeLicensePlate } from "../../lib/license-plate";
import { pairedVehicle, type PairedVehicle } from "../../lib/pairing";
import { RdwClient } from "../../lib/rdw-client";
import { isApkExpired, matchesUpcomingApk, RDW_YES, STORE, type SyncEvent } from "../../lib/vehicle-sync";

interface DeviceArgs {
  device: Homey.Device;
}

interface UpcomingApkArgs extends DeviceArgs {
  days_until_apk: number;
}

interface UpcomingApkState {
  days_until_apk: number;
}

type TriggerId = Exclude<SyncEvent["type"], "notification">;

const TRIGGER_IDS: TriggerId[] = [
  "apk_expired",
  "upcoming_apk_expiry_date",
  "apk_expiry_date_changed",
  "open_recall",
  "insurance_has_expired",
];

class VehicleDriver extends Homey.Driver {
  private triggers = new Map<TriggerId, Homey.FlowCardTriggerDevice>();

  async onInit(): Promise<void> {
    this.registerFlowCards();
    this.log("[driver] initialised");
  }

  async onPair(session: PairSession): Promise<void> {
    const client = new RdwClient();
    let licensePlate: string | undefined;
    let pairingDevice: PairedVehicle | null = null;

    session.setHandler("showView", async (view: string) => {
      if (view !== "verify") return;

      if (licensePlate === undefined) {
        await session.showView("add_by_license_plate");
        await session.emit("error", this.homey.__("error.license_plate_missing"));
        return;
      }

      const plate = licensePlate;
      try {
        const vehicle = await client.fetchVehicle(plate);
        if (vehicle === undefined) {
          await session.prevView();
          await session.emit("error", this.homey.__("messages.license_plate_not_found", { licensePlate: plate }));
          return;
        }
        pairingDevice = pairedVehicle(vehicle, plate);
        await session.showView("add_my_device");
      } catch (error) {
        this.error("[pair] lookup failed", error);
        await session.prevView();
        await session.emit("error", this.homey.__(errorMessageKey(error)));
      }
    });

    session.setHandler("getDevice", async (): Promise<PairedVehicle> => {
      if (pairingDevice === null) throw new Error(this.homey.__("error.generic"));
      return pairingDevice;
    });

    session.setHandler("getLicensePlate", async (): Promise<string> => licensePlate ?? "");

    session.setHandler("setLicensePlate", async (value: unknown): Promise<void> => {
      licensePlate = normalizeLicensePlate(value);
    });
  }

  /** Fires a device trigger. Notifications are app-wide and go through the notification manager. */
  async fire(device: Homey.Device, event: SyncEvent): Promise<void> {
    switch (event.type) {
      case "notification": {
        const licensePlate = device.getStoreValue(STORE.LICENSE_PLATE) as string;
        await this.homey.notifications.createNotification({ excerpt: this.homey.__(event.key, { licensePlate }) });
        return;
      }
      case "upcoming_apk_expiry_date":
        await this.trigger(event.type).trigger(device, {}, { days_until_apk: event.daysUntilApk });
        return;
      case "apk_expiry_date_changed":
        await this.trigger(event.type).trigger(device, { new_date: event.newDate });
        return;
      default:
        await this.trigger(event.type).trigger(device);
    }
  }

  private trigger(id: TriggerId): Homey.FlowCardTriggerDevice {
    const card = this.triggers.get(id);
    if (!card) throw new Error(`Trigger card ${id} is not registered`);
    return card;
  }

  private registerFlowCards(): void {
    for (const id of TRIGGER_IDS) this.triggers.set(id, this.homey.flow.getDeviceTriggerCard(id));

    this.trigger("upcoming_apk_expiry_date").registerRunListener(
      async (args: UpcomingApkArgs, state: UpcomingApkState) => matchesUpcomingApk(args.days_until_apk, state.days_until_apk),
    );

    this.homey.flow.getConditionCard("is_apk_expired").registerRunListener(
      async ({ device }: DeviceArgs) => isApkExpired(device.getStoreValue(STORE.APK_EXPIRY_DATE) as string, new Date()),
    );

    this.homey.flow.getConditionCard("has_open_recall").registerRunListener(
      async ({ device }: DeviceArgs) => device.getCapabilityValue("open_recall_indicator") === RDW_YES,
    );

    this.homey.flow.getConditionCard("is_insured").registerRunListener(
      async ({ device }: DeviceArgs) => device.getCapabilityValue("is_insured") === RDW_YES,
    );
  }
}

module.exports = VehicleDriver;
export type { VehicleDriver };
