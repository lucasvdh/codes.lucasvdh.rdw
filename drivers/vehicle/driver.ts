import {Driver, FlowCardCondition, FlowCardTriggerDevice} from "homey";
import {Device as DeviceType} from "./types";
import VehicleDevice from "./device";
import {RDWClient, Vehicle} from "../../rdw-client";

class VehicleDriver extends Driver {
  // Triggers
  private apkExpiredTrigger?: FlowCardTriggerDevice;
  private upcomingAPKExpiryDateTrigger?: FlowCardTriggerDevice;
  private apkExpiryDateChangedTrigger?: FlowCardTriggerDevice;
  private openRecallTrigger?: FlowCardTriggerDevice;
  private insuranceHasExpiredTrigger?: FlowCardTriggerDevice;
  // Conditions
  private isAPKExpiredCondition?: FlowCardCondition;
  private hasOpenRecallCondition?: FlowCardCondition;
  private isInsuredCondition?: FlowCardCondition;

  async onInit(): Promise<void> {
    this.log("Driver has been initialised");

    await this.registerFlowCards()
    this.log('Flow cards have been initialized')
  }

  async onPair(session: any): Promise<void> {
    let licensePlate: string | null = null;
    let pairingDevice: DeviceType | null = null
    const pairingClient: RDWClient = new RDWClient()

    session.setHandler('showView', async (view: string) => {
      this.log('Show view', view)

      if (view === "verify") {
        if (licensePlate === null) {
          await session.showView('add_device_by_license_plate');
          session.emit('error', 'License plate not set')
        }

        pairingClient
            .fetchVehicleData(licensePlate as string)
            .then(async (vehicle: Vehicle | undefined) => {
              if (vehicle === undefined) {
                await session.prevView();
                session.emit('error', this.homey.__('messages.license_plate_not_found', {licensePlate}))
              } else {
                pairingDevice = {
                  name: vehicle.merk + ' ' + vehicle.handelsbenaming,
                  data: {
                    id: vehicle.kenteken
                  },
                  settings: {},
                  store: {
                    license_plate: licensePlate as string,
                    apk_expiry_date: vehicle.vervaldatum_apk
                  }
                } as DeviceType;

                session.showView('add_my_device');
              }
            })
            .catch(async (error) => {
              session.prevView();

              session.emit('error', this.homey.__('messages.something_went_wrong', {error}))
            });
      }
    });

    session.setHandler('getDevice', async (): Promise<DeviceType> => {
      this.log('Get device', pairingDevice);
      if (pairingDevice === null) {
        throw new Error('Pairing device not set');
      }

      return pairingDevice
    })

    session.setHandler('getLicensePlate', async (): Promise<string | null> => {
      return licensePlate
    })

    session.setHandler('setLicensePlate', async (value: string): Promise<void> => {
      licensePlate = value;
    })
  }

  private async registerFlowCards() {
    this.apkExpiredTrigger = this.homey.flow.getDeviceTriggerCard('apk_expired')
    this.apkExpiryDateChangedTrigger = this.homey.flow.getDeviceTriggerCard('apk_expiry_date_changed')
    this.upcomingAPKExpiryDateTrigger = this.homey.flow.getDeviceTriggerCard('upcoming_apk_expiry_date')
    this.openRecallTrigger = this.homey.flow.getDeviceTriggerCard('open_recall')
    this.insuranceHasExpiredTrigger = this.homey.flow.getDeviceTriggerCard('insurance_has_expired')

    this.upcomingAPKExpiryDateTrigger.registerRunListener(async (args, state) => {
      return args.days_until_apk >= state.days_until_apk;
    });

    this.isAPKExpiredCondition = this.homey.flow.getConditionCard('is_apk_expired');
    this.isAPKExpiredCondition.registerRunListener(async (args: { device: VehicleDevice }, state) => {
      const daysUntilAPK = this.calculateDaysUntilFutureDate(args.device.getStoreValue('apk_expiry_date'));

      return daysUntilAPK <= 0;
    });

    this.hasOpenRecallCondition = this.homey.flow.getConditionCard('has_open_recall');
    this.hasOpenRecallCondition.registerRunListener(async (args: { device: VehicleDevice }, state) => {
      return args.device.getCapabilityValue('open_recall_indicator') === 'Ja';
    });

    this.isInsuredCondition = this.homey.flow.getConditionCard('is_insured');
    this.isInsuredCondition.registerRunListener(async (args: { device: VehicleDevice }, state) => {
      return args.device.getCapabilityValue('is_insured') === 'Ja';
    });
  }

  public triggerAPKExpiryDateChangedTrigger(device: VehicleDevice, args: { date: string }) {
    this.apkExpiryDateChangedTrigger?.trigger(device, {
      new_date: args.date,
    }).catch(this.error);
  }

  public triggerOpenRecallTrigger(device: VehicleDevice) {
    this.openRecallTrigger?.trigger(device).catch(this.error);
  }

  public triggerInsuranceHasExpiredTrigger(device: VehicleDevice) {
    this.insuranceHasExpiredTrigger?.trigger(device).catch(this.error);
  }

  public triggerAPKExpiryTriggers(device: VehicleDevice, args: { date: string }) {
    const daysUntilAPK = this.calculateDaysUntilFutureDate(args.date);
    const licensePlate = device.getStoreValue('license_plate');

    if (daysUntilAPK === 0) {
      this.homey.notifications.createNotification({
        excerpt: this.homey.__('messages.has_expired', {licensePlate})
      }).catch(error => {
        this.error('Error sending expiration notification: ' + error.message)
      });
    }

    if (daysUntilAPK === 30) {
      this.homey.notifications.createNotification({
        excerpt: this.homey.__('messages.expires_in_a_month', {licensePlate})
      }).catch(error => {
        this.error('Error sending expiration notification: ' + error.message)
      });
    }

    if (daysUntilAPK <= 0) {
      this.apkExpiredTrigger?.trigger(device).catch(this.error);
    }

    this.upcomingAPKExpiryDateTrigger?.trigger(device, undefined, {
      days_until_apk: daysUntilAPK,
    }).catch(this.error);
  }

  private calculateDaysUntilFutureDate(dateString: string) {
    const now = new Date();
    const futureYear = parseInt(dateString.slice(0, 4));
    const futureMonth = parseInt(dateString.slice(4, 6)) - 1; // Months are 0-based in JavaScript
    const futureDay = parseInt(dateString.slice(6, 8));

    const futureDate = new Date(futureYear, futureMonth, futureDay);

    // Calculate the difference in milliseconds
    const timeDifference = futureDate.getTime() - now.getTime();

    return Math.floor(timeDifference / (1000 * 3600 * 24));
  }
}

module.exports = VehicleDriver;

export default VehicleDriver;