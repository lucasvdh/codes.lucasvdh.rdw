import type { CapabilityValues, SyncEvent, SyncPlan, VehicleSnapshot } from "./vehicle-sync";

/** Where a sync plan lands. Implementations handle and log their own errors. */
export interface SyncTarget {
  setCapability(id: keyof CapabilityValues, value: string | null): Promise<void>;
  saveSnapshot(snapshot: Required<VehicleSnapshot>): Promise<void>;
  fire(event: SyncEvent): Promise<void>;
}

export async function applySyncPlan(plan: SyncPlan, target: SyncTarget): Promise<void> {
  for (const [id, value] of Object.entries(plan.capabilities) as [keyof CapabilityValues, string | null][]) {
    await target.setCapability(id, value);
  }
  for (const event of plan.events) await target.fire(event);
  await target.saveSnapshot(plan.snapshot);
}
