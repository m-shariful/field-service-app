import { getDatabase } from "@/db/database";
import {
  getSyncQueueSummary,
  type SyncQueueSummary,
} from "@/repositories/sync-queue.repository";
import { useAuthStore } from "@/stores/auth.store";
import { useSyncStore } from "@/stores/sync.store";

import { syncPendingMutations } from "./sync-engine";
import { pullJobChanges } from "./sync-pull.service";

export interface FullSyncResult {
  push: Awaited<ReturnType<typeof syncPendingMutations>>;
  pull: Awaited<ReturnType<typeof pullJobChanges>>;
}

const EMPTY_QUEUE_SUMMARY: SyncQueueSummary = {
  queued: 0,
  conflicts: 0,
  failed: 0,
};

const EMPTY_SYNC_RESULT: FullSyncResult = {
  push: {
    processed: 0,
    succeeded: 0,
    retried: 0,
    conflicts: 0,
    failed: 0,
  },
  pull: {
    pages: 0,
    jobsApplied: 0,
    cursor: null,
    hasMore: false,
  },
};

function logSyncExecution(event: string, details?: Record<string, unknown>) {
  console.log("[Sync Execution]", {
    timestamp: new Date().toISOString(),
    event,
    ...details,
  });
}

/**
 * Refresh the visible queue counts without allowing a local
 * database failure to hide the primary sync result.
 */
export async function refreshSyncQueueSummary(): Promise<void> {
  const userId = useAuthStore.getState().user?.id;

  if (!userId) {
    useSyncStore.getState().setQueueSummary(EMPTY_QUEUE_SUMMARY);
    return;
  }

  try {
    const db = await getDatabase();
    const summary = await getSyncQueueSummary(db, userId);

    useSyncStore.getState().setQueueSummary(summary);
  } catch (error) {
    console.warn("Failed to refresh sync queue summary:", error);
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Synchronization could not be completed.";
}

async function runFullSync(): Promise<FullSyncResult> {
  const authState = useAuthStore.getState();

  if (
    !authState.user ||
    !authState.isAuthenticated ||
    authState.sessionMode !== "online"
  ) {
    await refreshSyncQueueSummary();
    return EMPTY_SYNC_RESULT;
  }

  useSyncStore.getState().startSync();

  try {
    // Push local mutations before pulling remote changes.
    const push = await syncPendingMutations();

    const pull = await pullJobChanges();

    await refreshSyncQueueSummary();

    // If there are unresolved mutations, the sync was interrupted.
    const hasUnresolvedMutations =
      push.retried > 0 || push.conflicts > 0 || push.failed > 0;

    const pullIncomplete = pull.hasMore;

    if (hasUnresolvedMutations || pullIncomplete) {
      useSyncStore.getState().finishPartialSync();
    } else {
      useSyncStore.getState().finishSync(new Date().toISOString());
    }

    return { push, pull };
  } catch (error) {
    await refreshSyncQueueSummary();

    useSyncStore.getState().failSync(getErrorMessage(error));

    throw error;
  }
}

/**
 * Single-flight synchronization:
 *
 * If startup, network reconnection, and the UI request a sync
 * simultaneously, they all share the same in-flight operation.
 */
let inFlightSync: Promise<FullSyncResult> | null = null;

export function syncNow(): Promise<FullSyncResult> {
  if (inFlightSync) {
    logSyncExecution("joined-in-flight-sync");
    return inFlightSync;
  }

  logSyncExecution("new-sync-started");

  const currentSync = runFullSync();

  inFlightSync = currentSync;

  void currentSync.then(
    (result) => {
      logSyncExecution("sync-finished", {
        pushProcessed: result.push.processed,
        pullPages: result.pull.pages,
        jobsApplied: result.pull.jobsApplied,
      });

      if (inFlightSync === currentSync) {
        inFlightSync = null;
      }
    },
    (error: unknown) => {
      logSyncExecution("sync-failed", {
        error: error instanceof Error ? error.message : String(error),
      });

      if (inFlightSync === currentSync) {
        inFlightSync = null;
      }
    },
  );

  return currentSync;
}
