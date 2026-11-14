export type WarningKey = "device.warning.vehicle_not_found" | "device.warning.rdw_unreachable";

/** What to do with the device warning: set one, clear it, or leave it as it is (undefined). */
export type WarningChange = { set: WarningKey } | { clear: true } | undefined;

/** Turns sync outcomes into device warning changes, so a warning only changes when the state does. */
export class SyncHealth {
  static readonly FAILURES_BEFORE_WARNING = 5;

  /** "unknown" until the first outcome, so a warning shown from before a restart gets cleared. */
  private warning: WarningKey | undefined | "unknown" = "unknown";
  private failures = 0;

  succeeded(): WarningChange {
    this.failures = 0;
    return this.change(undefined);
  }

  notFound(): WarningChange {
    this.failures = 0;
    return this.change("device.warning.vehicle_not_found");
  }

  failed(): WarningChange {
    this.failures++;
    if (this.failures < SyncHealth.FAILURES_BEFORE_WARNING) return undefined;
    return this.change("device.warning.rdw_unreachable");
  }

  private change(next: WarningKey | undefined): WarningChange {
    if (next === this.warning) return undefined;
    this.warning = next;
    return next === undefined ? { clear: true } : { set: next };
  }
}
