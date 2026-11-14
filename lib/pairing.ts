import type { VehicleRecord } from "./vehicle";
import { STORE } from "./vehicle-sync";

export interface PairedVehicle {
  name: string;
  data: { id: string };
  settings: Record<string, never>;
  store: {
    [STORE.LICENSE_PLATE]: string;
    [STORE.APK_EXPIRY_DATE]: string;
  };
}

export function pairedVehicle(vehicle: VehicleRecord, licensePlate: string): PairedVehicle {
  return {
    name: `${vehicle.merk} ${vehicle.handelsbenaming}`,
    data: { id: vehicle.kenteken },
    settings: {},
    store: {
      [STORE.LICENSE_PLATE]: licensePlate,
      [STORE.APK_EXPIRY_DATE]: vehicle.vervaldatum_apk,
    },
  };
}
