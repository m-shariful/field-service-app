import { syncPendingMutations } from "./sync-engine";
import { pullJobChanges } from "./sync-pull.service";

export interface FullSyncResult {
  push: Awaited<ReturnType<typeof syncPendingMutations>>;

  pull: Awaited<ReturnType<typeof pullJobChanges>>;
}

export async function syncNow(): Promise<FullSyncResult> {
  const push = await syncPendingMutations();

  const pull = await pullJobChanges();

  return {
    push,
    pull,
  };
}
