import type { CapabilityValues, SyncEvent, SyncPlan, VehicleSnapshot } from "./vehicle-sync";

/** Where a sync plan lands. Implementations handle and log their own errors. */
export interface SyncTarget {
  setCapability(id: keyof CapabilityValues, value: string | null): Promise<void>;
  saveSnapshot(snapshot: Required<VehicleSnapshot>): Promise<void>;
  fire(event: SyncEvent): Promise<void>;
}

/**
 * Triggers fire last: conditions in the triggered Flows read the capabilities and the store.
 * Every step first checks `isCurrent`, so a sync stops as soon as its device is gone.
 */
export async function applySyncPlan(
  plan: SyncPlan,
  target: SyncTarget,
  isCurrent: () => boolean = () => true,
): Promise<void> {
  for (const [id, value] of Object.entries(plan.capabilities) as [keyof CapabilityValues, string | null][]) {
    if (!isCurrent()) return;
    await target.setCapability(id, value);
  }
  if (!isCurrent()) return;
  await target.saveSnapshot(plan.snapshot);
  for (const event of plan.events) {
    if (!isCurrent()) return;
    await target.fire(event);
  }
}
