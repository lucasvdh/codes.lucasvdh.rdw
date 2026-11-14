export type WarningKey = "device.warning.vehicle_not_found" | "device.warning.rdw_unreachable";

/** What to do with the device warning: set one, clear it, or leave it as it is (undefined). */
export type WarningChange = { set: WarningKey } | { clear: true } | undefined;

/** Turns sync outcomes into device warning changes. */
export class SyncHealth {
  static readonly FAILURES_BEFORE_WARNING = 5;

  succeeded(): WarningChange {
    return undefined;
  }

  notFound(): WarningChange {
    return undefined;
  }

  failed(): WarningChange {
    return undefined;
  }
}
