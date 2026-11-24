import { apiDelete, apiPatch, apiPost } from "@/api/client";
import {
  acknowledgeServerDeletedJob,
  acknowledgeServerJob,
  getLocalJob,
  markLocalJobConflict,
  restoreConflictedPendingDelete,
  type ServerJob,
} from "@/repositories/local-jobs.repository";
import {
  claimNextDueMutation,
  hasPendingMutationsForEntity,
  markEntityMutationsConflict,
  markMutationCancelled,
  markMutationFailed,
  markMutationRetry,
  markMutationSynced,
  recoverStaleSyncingMutations,
  updateMutationPayload,
} from "@/repositories/sync-queue.repository";

import { ApiError } from "@/api/api-error";
import { getDatabase } from "@/db/database";
import type { SyncQueueItem } from "@/db/types";
import type { Job } from "@/features/jobs/types";
import { useAuthStore } from "@/stores/auth.store";
import { isAbortError, throwIfAborted } from "@/utils/abort";
import type { SQLiteDatabase } from "expo-sqlite";

const SYNC_BATCH_SIZE = 20;

// Existing recovery threshold. This is not a complete worker lease.
const STALE_SYNCING_MS = 2 * 60 * 1000;

const MAX_ATTEMPTS = 8;

interface JobResponse {
  data: Job;
}

function getCurrentUserId(): string | null {
  return useAuthStore.getState().user?.id ?? null;
}

function calculateRetryDelay(attemptCount: number): number {
  const exponentialDelay = 1000 * Math.pow(2, Math.max(0, attemptCount - 1));
  const cappedDelay = Math.min(exponentialDelay, 5 * 60 * 1000);
  const jitter = Math.floor(Math.random() * 500);

  return cappedDelay + jitter;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return `${error.status}:${error.code ?? "API_ERROR"}:${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

async function syncDeleteMutation(
  jobId: string,
  mutationId: string,
  payload: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<Job> {
  const baseVersion = payload.baseVersion;

  if (
    typeof baseVersion !== "number" ||
    !Number.isInteger(baseVersion) ||
    baseVersion < 1
  ) {
    throw new Error("JOB_DELETE_BASE_VERSION_MISSING_OR_INVALID");
  }

  const response = await apiDelete<JobResponse>(
    `/api/jobs/${jobId}`,
    { baseVersion },
    {
      headers: {
        "Idempotency-Key": mutationId,
      },
      signal,
    },
  );

  return response.data;
}

async function syncCreateMutation(
  userId: string,
  mutationId: string,
  payload: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<Job> {
  const response = await apiPost<JobResponse>("/api/jobs", payload, {
    headers: {
      "Idempotency-Key": mutationId,
    },
    signal,
  });

  return response.data;
}

async function syncUpdateMutation(
  jobId: string,
  mutationId: string,
  payload: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<Job> {
  const response = await apiPatch<JobResponse>(
    `/api/jobs/${jobId}/status`,
    payload,
    {
      headers: {
        "Idempotency-Key": mutationId,
      },
      signal,
    },
  );

  return response.data;
}

async function prepareUpdatePayload(
  db: SQLiteDatabase,
  userId: string,
  mutation: SyncQueueItem,
): Promise<Record<string, unknown>> {
  const baseVersion = mutation.payload.baseVersion;

  // Existing numeric versions are immutable anchors.
  if (typeof baseVersion === "number") {
    if (!Number.isInteger(baseVersion) || baseVersion < 1) {
      throw new Error("INVALID_JOB_BASE_VERSION");
    }

    return mutation.payload;
  }

  // Only null means a locally created job had no server version.
  if (baseVersion !== null) {
    throw new Error("JOB_BASE_VERSION_MISSING_OR_INVALID");
  }

  const localJob = await getLocalJob(db, userId, mutation.entityId);

  if (!localJob) {
    throw new Error("LOCAL_JOB_NOT_FOUND");
  }

  if (localJob.version === null) {
    throw new Error("JOB_SERVER_VERSION_REQUIRED");
  }

  const resolvedPayload: Record<string, unknown> = {
    ...mutation.payload,
    baseVersion: localJob.version,
  };

  // Persist the finalized payload before the network request.
  await updateMutationPayload(db, userId, mutation.id, resolvedPayload);

  mutation.payload = resolvedPayload;

  return resolvedPayload;
}

async function executeMutation(
  db: SQLiteDatabase,
  userId: string,
  mutation: SyncQueueItem,
  signal?: AbortSignal,
): Promise<Job> {
  throwIfAborted(signal);

  switch (mutation.operation) {
    case "create":
      return syncCreateMutation(
        userId,
        mutation.mutationId,
        mutation.payload,
        signal,
      );

    case "update": {
      const payload = await prepareUpdatePayload(db, userId, mutation);

      throwIfAborted(signal);

      return syncUpdateMutation(
        mutation.entityId,
        mutation.mutationId,
        payload,
        signal,
      );
    }

    case "delete":
      return syncDeleteMutation(
        mutation.entityId,
        mutation.mutationId,
        mutation.payload,
        signal,
      );
  }
}

export interface SyncResult {
  processed: number;
  succeeded: number;
  retried: number;
  conflicts: number;
  failed: number;
}

export async function syncPendingMutations(
  signal?: AbortSignal,
): Promise<SyncResult> {
  const authState = useAuthStore.getState();

  if (
    !authState.user ||
    !authState.isAuthenticated ||
    authState.sessionMode !== "online"
  ) {
    return {
      processed: 0,
      succeeded: 0,
      retried: 0,
      conflicts: 0,
      failed: 0,
    };
  }

  const userId = getCurrentUserId();

  if (!userId) {
    return {
      processed: 0,
      succeeded: 0,
      retried: 0,
      conflicts: 0,
      failed: 0,
    };
  }

  throwIfAborted(signal);

  const db = await getDatabase();

  // Recover mutations left syncing after an interrupted process.
  await recoverStaleSyncingMutations(
    db,
    userId,
    new Date(Date.now() - STALE_SYNCING_MS),
  );

  const result: SyncResult = {
    processed: 0,
    succeeded: 0,
    retried: 0,
    conflicts: 0,
    failed: 0,
  };

  /**
   * Claim and process one mutation at a time.
   *
   * claimNextDueMutation already:
   * - selects one due mutation
   * - transitions it to syncing atomically
   * - increments attemptCount
   *
   * Do not call markMutationSyncing here.
   */
  while (result.processed < SYNC_BATCH_SIZE) {
    throwIfAborted(signal);

    const mutation = await claimNextDueMutation(db, userId, new Date());

    if (!mutation) {
      break;
    }

    result.processed += 1;

    // The claim already incremented attemptCount.
    const currentAttempt = mutation.attemptCount;

    try {
      // Keep this inside try so an abort after claiming
      // still returns the mutation to retry.
      throwIfAborted(signal);

      const serverJob = await executeMutation(db, userId, mutation, signal);

      if (mutation.operation === "delete") {
        await acknowledgeServerDeletedJob(db, userId, serverJob as ServerJob);

        await markMutationSynced(db, userId, mutation.id);

        result.succeeded += 1;
        continue;
      }

      await markMutationSynced(db, userId, mutation.id);

      const hasPendingMutations = await hasPendingMutationsForEntity(
        db,
        userId,
        mutation.entityType,
        mutation.entityId,
      );

      await acknowledgeServerJob(db, userId, serverJob, hasPendingMutations);

      result.succeeded += 1;
    } catch (error) {
      if (isAbortError(error, signal)) {
        await markMutationCancelled(db, userId, mutation.id);
        throw error;
      }

      // Preserve the mutation when authentication needs attention.
      if (error instanceof ApiError && error.status === 401) {
        const retryAt = new Date(Date.now() + 5 * 60 * 1000);

        await markMutationRetry(
          db,
          userId,
          mutation.id,
          retryAt.toISOString(),
          "AUTHENTICATION_REQUIRED",
        );

        result.retried += 1;
        break;
      }

      if (
        error instanceof ApiError &&
        error.status === 409 &&
        (error.code === "JOB_VERSION_CONFLICT" ||
          error.code === "JOB_ALREADY_DELETED")
      ) {
        const errorMessage = getErrorMessage(error);

        // Conflict the current and all dependent queued mutations.
        await markEntityMutationsConflict(
          db,
          userId,
          mutation.entityType,
          mutation.entityId,
          errorMessage,
        );

        if (mutation.entityType === "job") {
          if (mutation.operation === "delete") {
            await restoreConflictedPendingDelete(db, userId, mutation.entityId);
          } else {
            await markLocalJobConflict(db, userId, mutation.entityId);
          }
        }

        result.conflicts += 1;
        continue;
      }

      const retryable = !(error instanceof ApiError) || error.status >= 500;

      if (retryable) {
        if (currentAttempt >= MAX_ATTEMPTS) {
          await markMutationFailed(
            db,
            userId,
            mutation.id,
            `MAX_ATTEMPTS:${getErrorMessage(error)}`,
          );

          result.failed += 1;
        } else {
          const delay = calculateRetryDelay(currentAttempt);
          const retryAt = new Date(Date.now() + delay);

          await markMutationRetry(
            db,
            userId,
            mutation.id,
            retryAt.toISOString(),
            getErrorMessage(error),
          );

          result.retried += 1;
        }

        // Stop this run when the server/network is unavailable.
        break;
      }

      // Other 4xx responses are permanent for this mutation.
      await markMutationFailed(db, userId, mutation.id, getErrorMessage(error));

      result.failed += 1;
    }
  }

  return result;
}
