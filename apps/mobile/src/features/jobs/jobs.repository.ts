import type { Job, JobPriority } from "./types";
import { apiGet, apiPatch, apiPost } from "@/api/client";
import {
  getLocalJob,
  insertLocalJob,
  listLocalJobs,
  replaceServerSnapshot,
  updateLocalJobStatus,
  upsertServerJob,
} from "@/repositories/local-jobs.repository";

import { ApiError } from "@/api/api-error";
import type { LocalJob } from "@/db/types";
import { enqueueMutation } from "@/repositories/sync-queue.repository";
import { getDatabase } from "@/db/database";
import { useAuthStore } from "@/stores/auth.store";

export interface JobsResponse {
  data: Job[];
}

export interface JobResponse {
  data: Job;
}

export interface CreateJobInput {
  title: string;
  scheduledAt: string;
  location: string;
  priority: JobPriority;
}

function getCurrentUserId(): string {
  const userId = useAuthStore.getState().user?.id;

  if (!userId) {
    throw new Error("AUTHENTICATED_USER_REQUIRED");
  }

  return userId;
}

function isOfflineSession(): boolean {
  return useAuthStore.getState().sessionMode === "offline";
}

function shouldFallbackToLocal(error: unknown): boolean {
  /**
   * A network failure means the server may simply be unreachable.
   *
   * 4xx responses remain authoritative API/domain failures.
   */
  if (!(error instanceof ApiError)) {
    return true;
  }

  return error.status >= 500;
}

function generateLocalJobId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `local-job-${globalThis.crypto.randomUUID()}`;
  }

  return `local-job-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Reads cached jobs without allowing a local-database failure
 * to hide the original network/API failure.
 */
async function readCachedJobs(userId: string): Promise<Job[] | null> {
  try {
    const db = await getDatabase();

    const jobs = await listLocalJobs(db, userId);

    return jobs.length > 0 ? (jobs as Job[]) : null;
  } catch (error) {
    console.warn("Failed to read local jobs cache:", error);

    return null;
  }
}

/**
 * Best-effort server -> local cache update.
 *
 * Important:
 * local-jobs.repository protects pending local mutations.
 */
async function cacheServerJobs(userId: string, jobs: Job[]): Promise<void> {
  try {
    const db = await getDatabase();

    await replaceServerSnapshot(db, userId, jobs);
  } catch (error) {
    console.warn("Failed to update local jobs cache:", error);
  }
}

async function cacheServerJob(userId: string, job: Job): Promise<void> {
  try {
    const db = await getDatabase();

    await upsertServerJob(db, userId, job);
  } catch (error) {
    console.warn("Failed to update local job cache:", error);
  }
}

async function readCachedJob(
  userId: string,
  jobId: string,
): Promise<Job | null> {
  try {
    const db = await getDatabase();

    const job = await getLocalJob(db, userId, jobId);

    return job as Job | null;
  } catch (error) {
    console.warn("Failed to read local job cache:", error);

    return null;
  }
}

async function createLocalJob(
  userId: string,
  input: CreateJobInput,
): Promise<Job> {
  const db = await getDatabase();

  const now = new Date().toISOString();

  const localJob: LocalJob = {
    id: generateLocalJobId(),

    userId,

    title: input.title,
    scheduledAt: input.scheduledAt,
    location: input.location,

    status: "scheduled",
    priority: input.priority,

    createdAt: now,
    updatedAt: now,

    serverUpdatedAt: null,
    localUpdatedAt: now,

    syncStatus: "pending_create",

    deletedAt: null,
  };

  await db.withTransactionAsync(async () => {
    /**
     * Atomic local write:
     *
     * Either both the job and its outbox mutation exist,
     * or neither exists.
     */
    await insertLocalJob(db, userId, localJob);

    await enqueueMutation(db, {
      userId,

      entityType: "job",
      entityId: localJob.id,

      operation: "create",

      payload: {
        id: localJob.id,
        title: localJob.title,
        scheduledAt: localJob.scheduledAt,
        location: localJob.location,
        priority: localJob.priority,
      },
    });
  });

  return localJob as Job;
}

async function updateLocalJobStatusOffline(
  userId: string,
  id: string,
  status: Job["status"],
): Promise<Job> {
  const db = await getDatabase();

  const existingJob = await getLocalJob(db, userId, id);

  if (!existingJob) {
    throw new Error("LOCAL_JOB_NOT_FOUND");
  }

  const baseVersion = existingJob.serverUpdatedAt;

  let updatedJob: LocalJob;

  await db.withTransactionAsync(async () => {
    updatedJob = await updateLocalJobStatus(db, userId, id, status);

    await enqueueMutation(db, {
      userId,

      entityType: "job",
      entityId: id,

      operation: "update",

      payload: {
        status,

        /**
         * Future Sync Engine / server conflict detection
         * will use this version anchor.
         */
        baseVersion,
      },
    });
  });

  return updatedJob! as Job;
}

export async function getJobs(): Promise<Job[]> {
  const userId = getCurrentUserId();

  /**
   * When authentication explicitly says we are offline,
   * avoid making unnecessary network requests.
   */
  if (isOfflineSession()) {
    const cachedJobs = await readCachedJobs(userId);

    if (cachedJobs) {
      return cachedJobs;
    }

    throw new Error("OFFLINE_JOBS_UNAVAILABLE");
  }

  try {
    const response = await apiGet<JobsResponse>("/api/jobs");

    await cacheServerJobs(userId, response.data);

    /**
     * Read from SQLite after caching so pending local mutations
     * remain visible even if the server is behind.
     */
    const localJobs = await readCachedJobs(userId);

    return localJobs ?? response.data;
  } catch (error) {
    if (!shouldFallbackToLocal(error)) {
      throw error;
    }

    const cachedJobs = await readCachedJobs(userId);

    if (cachedJobs) {
      return cachedJobs;
    }

    throw error;
  }
}

export async function getJobById(id: string): Promise<Job> {
  const userId = getCurrentUserId();

  if (isOfflineSession()) {
    const cachedJob = await readCachedJob(userId, id);

    if (cachedJob) {
      return cachedJob;
    }

    throw new Error("OFFLINE_JOB_UNAVAILABLE");
  }

  try {
    const response = await apiGet<JobResponse>(`/api/jobs/${id}`);

    await cacheServerJob(userId, response.data);

    /**
     * Return the local version after caching.
     *
     * If an offline mutation is pending, the local version
     * remains authoritative for the current device.
     */
    const localJob = await readCachedJob(userId, id);

    return localJob ?? response.data;
  } catch (error) {
    if (!shouldFallbackToLocal(error)) {
      throw error;
    }

    const cachedJob = await readCachedJob(userId, id);

    if (cachedJob) {
      return cachedJob;
    }

    throw error;
  }
}

export async function updateJobStatus(
  id: string,
  status: Job["status"],
): Promise<Job> {
  const userId = getCurrentUserId();

  /**
   * Explicit offline mode.
   */
  if (isOfflineSession()) {
    return updateLocalJobStatusOffline(userId, id, status);
  }

  try {
    const response = await apiPatch<JobResponse>(`/api/jobs/${id}/status`, {
      status,
    });

    await cacheServerJob(userId, response.data);

    return response.data;
  } catch (error) {
    /**
     * Only network failures are converted into offline
     * outbox mutations at this stage.
     *
     * A 4xx business/domain response remains authoritative.
     */
    if (error instanceof ApiError) {
      throw error;
    }

    return updateLocalJobStatusOffline(userId, id, status);
  }
}

export async function createJob(input: CreateJobInput): Promise<Job> {
  const userId = getCurrentUserId();

  /**
   * Explicit offline session.
   */
  if (isOfflineSession()) {
    return createLocalJob(userId, input);
  }

  try {
    const response = await apiPost<JobResponse>("/api/jobs", input);

    await cacheServerJob(userId, response.data);

    return response.data;
  } catch (error) {
    /**
     * Network failure:
     *
     * Persist locally instead of losing the user's work.
     *
     * We deliberately do NOT queue 4xx responses.
     */
    if (error instanceof ApiError) {
      throw error;
    }

    return createLocalJob(userId, input);
  }
}
