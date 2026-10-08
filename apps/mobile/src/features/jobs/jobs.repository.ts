import type { Job, JobPriority } from "./types";
import {
  ServerJob,
  getLocalJob,
  listLocalJobs,
  replaceServerSnapshot,
  upsertServerJob,
} from "@/repositories/local-jobs.repository";
import { apiGet, apiPatch, apiPost } from "@/api/client";

import { ApiError } from "@/api/api-error";
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

/**
 * A 4xx response represents a known API/domain decision.
 *
 * Example:
 * - 401: authentication/session problem
 * - 404: resource does not exist
 * - 409: conflict/business rule
 *
 * We should not silently replace those with stale local data.
 *
 * A network error or 5xx response can reasonably fall back
 * to the local cache because the server may simply be unavailable.
 */
function shouldFallbackToLocal(error: unknown): boolean {
  if (!(error instanceof ApiError)) {
    return true;
  }

  return error.status >= 500;
}

/**
 * Reads cached jobs without allowing a local-database failure
 * to hide the original network/API failure.
 *
 * This is especially important for web because the native
 * SQLite configuration is not our current web target.
 */
async function readCachedJobs(userId: string): Promise<Job[] | null> {
  try {
    const db = await getDatabase();
    const jobs = await listLocalJobs(db, userId);

    return jobs.length > 0 ? jobs : null;
  } catch (error) {
    console.warn("Failed to read local jobs cache:", error);

    return null;
  }
}

/**
 * Updates the local cache from a successful server response.
 *
 * Cache failures should not make an otherwise successful API
 * request fail. The server response remains authoritative.
 */
async function cacheServerJobs(
  userId: string,
  jobs: ServerJob[],
): Promise<void> {
  try {
    const db = await getDatabase();

    await replaceServerSnapshot(db, userId, jobs);
  } catch (error) {
    console.warn("Failed to update local jobs cache:", error);
  }
}

/**
 * Cache one successful server job.
 *
 * This is best-effort for the same reason as cacheServerJobs().
 */
async function cacheServerJob(userId: string, job: Job): Promise<void> {
  try {
    const db = await getDatabase();

    await upsertServerJob(db, userId, job);
  } catch (error) {
    console.warn("Failed to update local job cache:", error);
  }
}

export async function getJobs(): Promise<Job[]> {
  const userId = getCurrentUserId();

  try {
    const response = await apiGet<JobsResponse>("/api/jobs");

    await cacheServerJobs(userId, response.data);

    return response.data;
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

  try {
    const response = await apiGet<JobResponse>(`/api/jobs/${id}`);

    await cacheServerJob(userId, response.data);

    return response.data;
  } catch (error) {
    if (!shouldFallbackToLocal(error)) {
      throw error;
    }

    try {
      const db = await getDatabase();
      const cachedJob = await getLocalJob(db, userId, id);

      if (cachedJob) {
        return cachedJob;
      }
    } catch (cacheError) {
      console.warn("Failed to read local job cache:", cacheError);
    }

    throw error;
  }
}

export async function updateJobStatus(
  id: string,
  status: Job["status"],
): Promise<Job> {
  const response = await apiPatch<JobResponse>(`/api/jobs/${id}/status`, {
    status,
  });

  const userId = getCurrentUserId();

  await cacheServerJob(userId, response.data);

  return response.data;
}

export async function createJob(input: CreateJobInput): Promise<Job> {
  const response = await apiPost<JobResponse>("/api/jobs", input);

  const userId = getCurrentUserId();

  await cacheServerJob(userId, response.data);

  return response.data;
}
