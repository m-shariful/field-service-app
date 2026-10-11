import { apiPatch, apiPost } from "@/api/client";
import {
  acknowledgeServerJob,
  markLocalJobConflict,
} from "@/repositories/local-jobs.repository";
import {
  hasPendingMutationsForEntity,
  listDueMutations,
  markMutationConflict,
  markMutationFailed,
  markMutationRetry,
  markMutationSynced,
  markMutationSyncing,
  recoverStaleSyncingMutations,
} from "@/repositories/sync-queue.repository";

import { ApiError } from "@/api/api-error";
import { getDatabase } from "@/db/database";
import type { Job } from "@/features/jobs/types";
import { useAuthStore } from "@/stores/auth.store";

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

async function executeMutation(
  userId: string,
  mutation: Awaited<ReturnType<typeof listDueMutations>>[number],
): Promise<Job> {
  switch (mutation.operation) {
    case "create":
      return syncCreateMutation(userId, mutation.mutationId, mutation.payload);

    case "update":
      return syncUpdateMutation(
        mutation.entityId,
        mutation.mutationId,
        mutation.payload,
      );

    case "delete":
      throw new Error("JOB_DELETE_SYNC_NOT_IMPLEMENTED");
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

  for (const mutation of mutations) {
    result.processed += 1;

    await markMutationSyncing(db, userId, mutation.id);

    const currentAttempt = mutation.attemptCount + 1;

    try {
      const serverJob = await executeMutation(userId, mutation);

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

      /**
       * 409 means the server has a domain/version conflict.
       */
      if (error instanceof ApiError && error.status === 409) {
        await markMutationConflict(
          db,
          userId,
          mutation.id,
          getErrorMessage(error),
        );

        if (mutation.entityType === "job") {
          await markLocalJobConflict(db, userId, mutation.entityId);
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
