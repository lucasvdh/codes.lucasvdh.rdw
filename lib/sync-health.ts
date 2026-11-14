export type WarningKey = "device.warning.vehicle_not_found" | "device.warning.rdw_unreachable";

/** What to do with the device warning: set one, clear it, or leave it as it is (undefined). */
export type WarningChange = { set: WarningKey } | { clear: true } | undefined;

/** Turns sync outcomes into device warning changes, so a warning only changes when the state does. */
export class SyncHealth {
  /** How long syncs must keep failing before the values count as outdated. */
  static readonly UNREACHABLE_AFTER_MS = 24 * 60 * 60 * 1000;

  /** "unknown" until the first outcome, so a warning shown from before a restart gets cleared. */
  private warning: WarningKey | undefined | "unknown" = "unknown";
  private failingSince: number | undefined;

  succeeded(): WarningChange {
    this.failingSince = undefined;
    return this.change(undefined);
  }

  notFound(): WarningChange {
    this.failingSince = undefined;
    return this.change("device.warning.vehicle_not_found");
  }

  failed(now: number): WarningChange {
    this.failingSince ??= now;
    if (now - this.failingSince < SyncHealth.UNREACHABLE_AFTER_MS) return undefined;
    return this.change("device.warning.rdw_unreachable");
  }

  private change(next: WarningKey | undefined): WarningChange {
    if (next === this.warning) return undefined;
    this.warning = next;
    return next === undefined ? { clear: true } : { set: next };
  }
}
