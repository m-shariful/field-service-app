import { getDatabase } from "@/db/database";
import {
  getSyncQueueSummary,
  type SyncQueueSummary,
} from "@/repositories/sync-queue.repository";
import { useAuthStore } from "@/stores/auth.store";
import { useSyncStore } from "@/stores/sync.store";

import { isAbortError } from "@/utils/abort";
import { syncPendingMutations } from "./sync-engine";
import { pullJobChanges } from "./sync-pull.service";
import {
  classifySyncError,
  createSyncRunId,
  emitSyncTelemetry,
} from "./sync-telemetry";

import type { SyncRunMetrics } from "./sync-telemetry";

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

interface SyncRunContext {
  runId: string;
  startedAt: string;
  startedAtMs: number;
}

function getDuration(context: SyncRunContext): number {
  return Math.max(0, Date.now() - context.startedAtMs);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Synchronization could not be completed.";
}

function emitRunCompleted(
  context: SyncRunContext,
  result: FullSyncResult,
  outcome: "success" | "partial",
): void {
  const completedAt = new Date().toISOString();

  const metrics: SyncRunMetrics = {
    runId: context.runId,
    startedAt: context.startedAt,
    completedAt,
    durationMs: getDuration(context),
    outcome,
    push: result.push,
    pull: {
      pages: result.pull.pages,
      jobsApplied: result.pull.jobsApplied,
      hasMore: result.pull.hasMore,
    },
  };

  useSyncStore.getState().setLastRunMetrics(metrics);

  emitSyncTelemetry("SYNC_RUN_COMPLETED", context.runId, {
    ...metrics,
  });
}

async function emitRunFailure(
  context: SyncRunContext,
  error: unknown,
  cancelled: boolean,
): Promise<void> {
  emitSyncTelemetry(
    cancelled ? "SYNC_RUN_CANCELLED" : "SYNC_RUN_FAILED",
    context.runId,
    {
      durationMs: getDuration(context),
      errorCategory: classifySyncError(error),
    },
  );
}

/**
 * Refresh visible queue counts without allowing a local
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

async function runFullSync(
  context: SyncRunContext,
  signal?: AbortSignal,
): Promise<FullSyncResult> {
  emitSyncTelemetry("SYNC_RUN_STARTED", context.runId, {
    startedAt: context.startedAt,
  });

  const authState = useAuthStore.getState();

  if (
    !authState.user ||
    !authState.isAuthenticated ||
    authState.sessionMode !== "online"
  ) {
    await refreshSyncQueueSummary();

    emitSyncTelemetry("SYNC_RUN_COMPLETED", context.runId, {
      durationMs: getDuration(context),
      outcome: "success",
      skipped: true,
      reason: "SESSION_NOT_ONLINE",
    });

    return EMPTY_SYNC_RESULT;
  }

  useSyncStore.getState().startSync();

  try {
    // Push local mutations before pulling remote changes.
    const push = await syncPendingMutations(signal);

    const pull = await pullJobChanges(signal);

    await refreshSyncQueueSummary();

    const hasUnresolvedMutations =
      push.retried > 0 || push.conflicts > 0 || push.failed > 0;

    const pullIncomplete = pull.hasMore;

    const outcome =
      hasUnresolvedMutations || pullIncomplete ? "partial" : "success";

    if (outcome === "partial") {
      useSyncStore.getState().finishPartialSync();
    } else {
      useSyncStore.getState().finishSync(new Date().toISOString());
    }

    const result = { push, pull };

    emitRunCompleted(context, result, outcome);

    return result;
  } catch (error) {
    await refreshSyncQueueSummary();

    const cancelled = isAbortError(error, signal);

    await emitRunFailure(context, error, cancelled);

    if (cancelled) {
      useSyncStore.getState().cancelSync();
      throw error;
    }

    useSyncStore.getState().failSync(getErrorMessage(error));

    throw error;
  }
}

/**
 * Single-flight synchronization:
 *
 * Concurrent callers share the same in-flight operation.
 */
let inFlightSync: Promise<FullSyncResult> | null = null;
let inFlightSyncController: AbortController | null = null;

export function syncNow(): Promise<FullSyncResult> {
  if (inFlightSync) {
    emitSyncTelemetry("SYNC_RUN_JOINED", "shared-in-flight");

    return inFlightSync;
  }

  const startedAtMs = Date.now();

  const context: SyncRunContext = {
    runId: createSyncRunId(),
    startedAt: new Date(startedAtMs).toISOString(),
    startedAtMs,
  };

  const controller = new AbortController();

  inFlightSyncController = controller;

  const currentSync = runFullSync(context, controller.signal);

  inFlightSync = currentSync;

  void currentSync.then(
    () => {
      if (inFlightSync === currentSync) {
        inFlightSync = null;
        inFlightSyncController = null;
      }
    },
    () => {
      if (inFlightSync === currentSync) {
        inFlightSync = null;
        inFlightSyncController = null;
      }
    },
  );

  return currentSync;
}

/**
 * Explicitly cancel the shared sync operation.
 *
 * Backgrounding the app must not automatically cancel sync.
 */
export function cancelInFlightSync(): boolean {
  if (!inFlightSyncController || inFlightSyncController.signal.aborted) {
    return false;
  }

  inFlightSyncController.abort();

  return true;
}
