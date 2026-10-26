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
  hasPendingMutationsForEntity,
  listDueMutations,
  markEntityMutationsConflict,
  markMutationFailed,
  markMutationRetry,
  markMutationSynced,
  markMutationSyncing,
  recoverStaleSyncingMutations,
  updateMutationPayload,
} from "@/repositories/sync-queue.repository";

import { ApiError } from "@/api/api-error";
import { getDatabase } from "@/db/database";
import type { Job } from "@/features/jobs/types";
import { useAuthStore } from "@/stores/auth.store";
import type { SQLiteDatabase } from "expo-sqlite";

const SYNC_BATCH_SIZE = 20;

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
    },
  );

  return response.data;
}

async function syncCreateMutation(
  userId: string,
  mutationId: string,
  payload: Record<string, unknown>,
): Promise<Job> {
  const response = await apiPost<JobResponse>("/api/jobs", payload, {
    headers: {
      "Idempotency-Key": mutationId,
    },
  });

  return response.data;
}

async function syncUpdateMutation(
  jobId: string,
  mutationId: string,
  payload: Record<string, unknown>,
): Promise<Job> {
  const response = await apiPatch<JobResponse>(
    `/api/jobs/${jobId}/status`,
    payload,
    {
      headers: {
        "Idempotency-Key": mutationId,
      },
    },
  );

  return response.data;
}

async function prepareUpdatePayload(
  db: SQLiteDatabase,
  userId: string,
  mutation: Awaited<ReturnType<typeof listDueMutations>>[number],
): Promise<Record<string, unknown>> {
  const baseVersion = mutation.payload.baseVersion;

  /**
   * Existing numeric versions are immutable anchors.
   *
   * Do not replace them with a newer local version;
   * a stale version must be allowed to produce a conflict.
   */
  if (typeof baseVersion === "number") {
    if (!Number.isInteger(baseVersion) || baseVersion < 1) {
      throw new Error("INVALID_JOB_BASE_VERSION");
    }

    return mutation.payload;
  }

  /**
   * Only null has a defined meaning here:
   * a locally created job had no server version when
   * this update was originally queued.
   *
   * Missing or malformed values are not silently rebased.
   */
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

  /**
   * Save before the network request, not after it.
   * This keeps retries stable if the server succeeds
   * but the mobile app never receives the response.
   */
  await updateMutationPayload(db, userId, mutation.id, resolvedPayload);

  // Use the same finalized payload for this attempt.
  mutation.payload = resolvedPayload;

  return resolvedPayload;
}

async function executeMutation(
  db: SQLiteDatabase,
  userId: string,
  mutation: Awaited<ReturnType<typeof listDueMutations>>[number],
): Promise<Job> {
  switch (mutation.operation) {
    case "create":
      return syncCreateMutation(userId, mutation.mutationId, mutation.payload);

    case "update": {
      const payload = await prepareUpdatePayload(db, userId, mutation);

      return syncUpdateMutation(
        mutation.entityId,
        mutation.mutationId,
        payload,
      );
    }

    case "delete":
      return syncDeleteMutation(
        mutation.entityId,
        mutation.mutationId,
        mutation.payload,
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

export async function syncPendingMutations(): Promise<SyncResult> {
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

  const db = await getDatabase();

  /**
   * Recover queue entries left in SYNCING state
   * after an interrupted app process.
   */
  await recoverStaleSyncingMutations(
    db,
    userId,
    new Date(Date.now() - STALE_SYNCING_MS),
  );

  const mutations = await listDueMutations(
    db,
    userId,
    new Date(),
    SYNC_BATCH_SIZE,
  );

  const result: SyncResult = {
    processed: 0,
    succeeded: 0,
    retried: 0,
    conflicts: 0,
    failed: 0,
  };

  const conflictedEntities = new Set<string>();

  for (const mutation of mutations) {
    const entityKey = `${mutation.entityType}:${mutation.entityId}`;

    if (conflictedEntities.has(entityKey)) {
      continue;
    }

    result.processed += 1;

    await markMutationSyncing(db, userId, mutation.id);

    const currentAttempt = mutation.attemptCount + 1;

    try {
      const serverJob = await executeMutation(db, userId, mutation);

      if (mutation.operation === "delete") {
        // Acknowledge the tombstone before marking the queue entry
        // synced. If local persistence fails, the request can retry
        // with the same idempotency key.
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
      /**
       * 401:
       *
       * The API client may already have attempted token
       * refresh. If the session is no longer recoverable,
       * the auth store will sign the user out.
       *
       * Keep the mutation for a future authenticated session.
       */
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
        error.code === "JOB_VERSION_CONFLICT"
      ) {
        const errorMessage = getErrorMessage(error);

        // Mark the current and all dependent queued mutations.
        await markEntityMutationsConflict(
          db,
          userId,
          mutation.entityType,
          mutation.entityId,
          errorMessage,
        );

        // Do not process another mutation for this entity
        // from the batch that was already loaded into memory.
        conflictedEntities.add(`${mutation.entityType}:${mutation.entityId}`);

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

      /**
       * Network/5xx errors are retryable.
       */
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

        /**
         * Do not hammer the server when it is unavailable.
         */
        break;
      }

      /**
       * Other 4xx responses represent a permanent
       * request/domain failure for the current mutation.
       */
      await markMutationFailed(db, userId, mutation.id, getErrorMessage(error));

      result.failed += 1;
    }
  }

  return result;
}
