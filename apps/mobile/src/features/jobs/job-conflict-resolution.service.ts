import {
  acknowledgeServerDeletedJob,
  getLocalJob,
  getLocalJobIncludingDeleted,
  prepareConflictedLocalJobForRetry,
  replaceConflictedLocalJobWithServer,
} from "@/repositories/local-jobs.repository";
import {
  deleteConflictedMutationsForEntity,
  enqueueMutation,
} from "@/repositories/sync-queue.repository";

import { apiGet } from "@/api/client";
import { getDatabase } from "@/db/database";
import { getNextJobStatus } from "@/features/jobs/job-status";
import type { Job } from "@/features/jobs/types";
import type { ServerJob } from "@/repositories/local-jobs.repository";
import { useAuthStore } from "@/stores/auth.store";

interface JobResponse {
  data: ServerJob;
}

export type JobConflictResolution = "use_server" | "keep_local";

function getCurrentUserId(): string {
  const userId = useAuthStore.getState().user?.id;

  if (!userId) {
    throw new Error("AUTHENTICATED_USER_REQUIRED");
  }

  return userId;
}

/**
 * Fetch the authoritative server job without allowing the
 * local cache to replace the response.
 */
export async function getLatestServerJobForConflict(
  jobId: string,
): Promise<Job> {
  const userId = getCurrentUserId();
  const db = await getDatabase();

  /**
   * A tombstone received from the server is sufficient to
   * resolve a remote deletion. The normal GET endpoint returns
   * 404 for deleted jobs, so do not request it again.
   */
  const local = await getLocalJobIncludingDeleted(db, userId, jobId);

  if (local && local.syncStatus === "conflict" && local.deletedAt != null) {
    if (
      typeof local.version !== "number" ||
      !Number.isInteger(local.version) ||
      local.version < 1
    ) {
      throw new Error("JOB_SERVER_VERSION_REQUIRED");
    }

    return {
      id: local.id,
      userId: local.userId,
      title: local.title,
      scheduledAt: local.scheduledAt,
      location: local.location,
      status: local.status,
      priority: local.priority,
      createdAt: local.createdAt,
      updatedAt: local.serverUpdatedAt ?? local.updatedAt,
      version: local.version,
      deletedAt: local.deletedAt,
    };
  }

  const response = await apiGet<JobResponse>(`/api/jobs/${jobId}`);
  const job = response.data;

  if (job.id !== jobId || job.userId !== userId) {
    throw new Error("INVALID_SERVER_JOB_RESPONSE");
  }

  if (
    typeof job.version !== "number" ||
    !Number.isInteger(job.version) ||
    job.version < 1
  ) {
    throw new Error("JOB_SERVER_VERSION_REQUIRED");
  }

  return job as Job;
}

/**
 * Resolve a previously detected job conflict.
 *
 * Both choices require a fresh server snapshot. If the device
 * is offline or the server cannot be reached, local conflict
 * state remains untouched.
 */
export async function resolveJobConflict(
  jobId: string,
  resolution: JobConflictResolution,
): Promise<Job> {
  const userId = getCurrentUserId();
  const db = await getDatabase();

  const localJob = await getLocalJob(db, userId, jobId);

  if (!localJob || localJob.syncStatus !== "conflict") {
    throw new Error("LOCAL_JOB_HAS_NO_CONFLICT");
  }

  const serverJob = await getLatestServerJobForConflict(jobId);

  /**
   * A remotely deleted job cannot accept a new status update.
   * "Use server" means accept the tombstone and discard the
   * conflicted queued changes.
   */
  if (serverJob.deletedAt != null) {
    if (resolution !== "use_server") {
      throw new Error("JOB_DELETED_ON_SERVER");
    }

    await db.withTransactionAsync(async () => {
      await acknowledgeServerDeletedJob(db, userId, serverJob as ServerJob);

      await deleteConflictedMutationsForEntity(db, userId, "job", jobId);
    });

    return {
      ...serverJob,
      syncStatus: "synced",
    };
  }

  /**
   * If the requested local status already matches the server,
   * keeping the server copy is enough to clear the conflict.
   */
  if (resolution === "use_server" || localJob.status === serverJob.status) {
    await db.withTransactionAsync(async () => {
      await replaceConflictedLocalJobWithServer(db, userId, serverJob);

      await deleteConflictedMutationsForEntity(db, userId, "job", jobId);
    });

    return serverJob;
  }

  /**
   * Reapply the local intent only if it remains a valid next
   * status from the latest server state.
   */
  const nextServerStatus = getNextJobStatus(serverJob.status);

  if (nextServerStatus !== localJob.status) {
    throw new Error("JOB_CONFLICT_CHANGE_NOT_APPLICABLE");
  }

  await db.withTransactionAsync(async () => {
    await prepareConflictedLocalJobForRetry(db, userId, serverJob);

    await deleteConflictedMutationsForEntity(db, userId, "job", jobId);

    /**
     * Use a new mutation ID and the latest server revision.
     * Do not revive the old stale mutation or its idempotency key.
     */
    await enqueueMutation(db, {
      userId,
      entityType: "job",
      entityId: jobId,
      operation: "update",
      payload: {
        status: localJob.status,
        baseVersion: serverJob.version,
      },
    });
  });

  const updatedLocalJob = await getLocalJob(db, userId, jobId);

  if (!updatedLocalJob) {
    throw new Error("LOCAL_JOB_CONFLICT_RETRY_PREPARATION_FAILED");
  }

  return updatedLocalJob as Job;
}
