import { apiGet, apiPatch, apiPost } from "@/api/client";
import {
  getLocalJob,
  getLocalJobIncludingDeleted,
  insertLocalJob,
  listLocalJobs,
  markLocalJobConflict,
  replaceServerSnapshot,
  upsertServerJob,
} from "@/repositories/local-jobs.repository";
import {
  enqueueMutation,
  markEntityMutationsConflict,
} from "@/repositories/sync-queue.repository";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createJob,
  getJobById,
  getJobs,
  getLocalJobs,
  updateJobStatus,
} from "../jobs.repository";

import { ApiError } from "@/api/api-error";
import { getDatabase } from "@/db/database";
import { useAuthStore } from "@/stores/auth.store";
import type { Job } from "../types";

vi.mock("@/api/client", () => ({
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
}));

vi.mock("@/db/database", () => ({
  getDatabase: vi.fn(),
}));

vi.mock("@/repositories/local-jobs.repository", () => ({
  getLocalJob: vi.fn(),
  listLocalJobs: vi.fn(),
  replaceServerSnapshot: vi.fn(),
  upsertServerJob: vi.fn(),
  insertLocalJob: vi.fn(),
  updateLocalJobStatus: vi.fn(),
  markLocalJobConflict: vi.fn(),
  acknowledgeServerDeletedJob: vi.fn(),
  getLocalJobIncludingDeleted: vi.fn(),
}));

vi.mock("@/repositories/sync-queue.repository", () => ({
  enqueueMutation: vi.fn(),
  markEntityMutationsConflict: vi.fn(),
}));

vi.mock("@/stores/auth.store", () => ({
  useAuthStore: {
    getState: vi.fn(),
  },
}));

const userId = "user-123";

const serverJobs: Job[] = [
  {
    id: "job-001",
    userId,
    title: "Repair generator",
    scheduledAt: "2026-10-10T10:00:00.000Z",
    location: "Rajshahi",
    status: "scheduled",
    priority: "high",
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-08T09:00:00.000Z",
    version: 1,
  },
  {
    id: "job-002",
    userId,
    title: "Inspect AC unit",
    scheduledAt: "2026-10-11T11:00:00.000Z",
    location: "Dhaka",
    status: "in_progress",
    priority: "medium",
    createdAt: "2026-10-01T09:00:00.000Z",
    updatedAt: "2026-10-08T10:00:00.000Z",
    version: 1,
  },
];

const cachedJobs: Job[] = [
  {
    ...serverJobs[0],
    status: "in_progress",
  },
];

function createDatabase() {
  return {} as Awaited<ReturnType<typeof getDatabase>>;
}

describe("jobs repository - offline aware reads", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: no cached jobs unless a test explicitly provides them.
    vi.mocked(listLocalJobs).mockResolvedValue([]);

    vi.mocked(useAuthStore.getState).mockReturnValue({
      user: {
        id: userId,
        name: "Test User",
        email: "test@example.com",
      },
      isAuthenticated: true,
      isLoading: false,
      sessionMode: "online",
      initializeAuth: vi.fn(),
      setSession: vi.fn(),
      signOut: vi.fn(),
    });

    vi.mocked(getDatabase).mockResolvedValue(createDatabase());
  });

  it("returns fresh server jobs when the API succeeds", async () => {
    vi.mocked(apiGet).mockResolvedValue({
      data: serverJobs,
    });

    const result = await getJobs();

    expect(result).toEqual(serverJobs);

    expect(apiGet).toHaveBeenCalledWith("/api/jobs");

    expect(replaceServerSnapshot).toHaveBeenCalledWith(
      expect.anything(),
      userId,
      serverJobs,
    );
  });

  it("falls back to the local cache on a network failure", async () => {
    const networkError = new TypeError("Network request failed");

    vi.mocked(apiGet).mockRejectedValue(networkError);

    vi.mocked(listLocalJobs).mockResolvedValue(cachedJobs as never);

    const result = await getJobs();

    expect(result).toEqual(cachedJobs);

    expect(listLocalJobs).toHaveBeenCalledWith(expect.anything(), userId);
  });

  it("falls back to the local cache on a server error", async () => {
    const serverError = new ApiError(
      "Service unavailable",
      503,
      "SERVICE_UNAVAILABLE",
    );

    vi.mocked(apiGet).mockRejectedValue(serverError);

    vi.mocked(listLocalJobs).mockResolvedValue(cachedJobs as never);

    const result = await getJobs();

    expect(result).toEqual(cachedJobs);
  });

  it("does not hide a 404 behind stale local data", async () => {
    const notFoundError = new ApiError("Job not found", 404, "JOB_NOT_FOUND");

    vi.mocked(apiGet).mockRejectedValue(notFoundError);

    await expect(getJobs()).rejects.toBe(notFoundError);

    expect(listLocalJobs).not.toHaveBeenCalled();
  });

  it("returns an API error when the server fails and no cache exists", async () => {
    const networkError = new TypeError("Network request failed");

    vi.mocked(apiGet).mockRejectedValue(networkError);

    vi.mocked(listLocalJobs).mockResolvedValue([]);

    await expect(getJobs()).rejects.toBe(networkError);
  });

  it("returns a fresh server job and caches it", async () => {
    const job = serverJobs[0];

    vi.mocked(apiGet).mockResolvedValue({
      data: job,
    });

    const result = await getJobById(job.id);

    expect(result).toEqual(job);

    expect(upsertServerJob).toHaveBeenCalledWith(
      expect.anything(),
      userId,
      job,
    );
  });

  it("falls back to one cached job when the API is unavailable", async () => {
    const networkError = new TypeError("Network request failed");
    const cachedJob = cachedJobs[0];

    vi.mocked(apiGet).mockRejectedValue(networkError);

    vi.mocked(getLocalJob).mockResolvedValue(cachedJob as never);

    const result = await getJobById(cachedJob.id);

    expect(result).toEqual(cachedJob);

    expect(getLocalJob).toHaveBeenCalledWith(
      expect.anything(),
      userId,
      cachedJob.id,
    );
  });

  it("does not fall back to cache for a 404 job lookup", async () => {
    const notFoundError = new ApiError("Job not found", 404, "JOB_NOT_FOUND");

    vi.mocked(apiGet).mockRejectedValue(notFoundError);
    vi.mocked(getLocalJobIncludingDeleted).mockResolvedValue(null);
    vi.mocked(getLocalJob).mockResolvedValue(null);

    await expect(getJobById("job-missing")).rejects.toBe(notFoundError);

    expect(getLocalJob).not.toHaveBeenCalled();
  });

  it("sends the edited baseVersion and caches the updated job", async () => {
    const updatedJob = {
      ...serverJobs[0],
      status: "in_progress" as const,
      version: 2,
    };

    vi.mocked(apiPatch).mockResolvedValue({
      data: updatedJob,
    });

    const result = await updateJobStatus(updatedJob.id, updatedJob.status, 1);

    expect(result).toEqual(updatedJob);

    expect(apiPatch).toHaveBeenCalledWith("/api/jobs/job-001/status", {
      status: "in_progress",
      baseVersion: 1,
    });

    expect(upsertServerJob).toHaveBeenCalledWith(
      expect.anything(),
      userId,
      updatedJob,
    );
  });

  it("caches a successfully created job", async () => {
    const createdJob = {
      ...serverJobs[0],
      id: "job-created",
      title: "New job",
    };

    vi.mocked(apiPost).mockResolvedValue({
      data: createdJob,
    });

    const result = await createJob({
      title: createdJob.title,
      location: createdJob.location,
      scheduledAt: createdJob.scheduledAt,
      priority: createdJob.priority,
    });

    expect(result).toEqual(createdJob);

    expect(upsertServerJob).toHaveBeenCalledWith(
      expect.anything(),
      userId,
      createdJob,
    );
  });

  it("creates a local job and queues a mutation while offline", async () => {
    vi.mocked(useAuthStore.getState).mockReturnValue({
      user: {
        id: userId,
        name: "Test User",
        email: "test@example.com",
      },
      isAuthenticated: true,
      isLoading: false,
      sessionMode: "offline",
      initializeAuth: vi.fn(),
      setSession: vi.fn(),
      signOut: vi.fn(),
    });

    const db = {
      withTransactionAsync: vi.fn(async (callback: () => Promise<void>) =>
        callback(),
      ),
    } as never;

    vi.mocked(getDatabase).mockResolvedValue(db);

    const result = await createJob({
      title: "Offline repair",
      scheduledAt: "2026-10-10T10:00:00.000Z",
      location: "Rajshahi",
      priority: "high",
    });

    expect(result.title).toBe("Offline repair");
    expect(result.id).toMatch(/^local-job-/);

    expect(insertLocalJob).toHaveBeenCalled();
    expect(enqueueMutation).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        userId,
        entityType: "job",
        operation: "create",
      }),
    );
  });

  it("marks a job as conflicted after a server version conflict", async () => {
    const db = createDatabase();

    vi.mocked(getDatabase).mockResolvedValue(db);

    const conflict = new ApiError(
      "This job was changed on the server.",
      409,
      "JOB_VERSION_CONFLICT",
    );

    vi.mocked(apiPatch).mockRejectedValue(conflict);

    await expect(updateJobStatus("job-001", "in_progress", 1)).rejects.toBe(
      conflict,
    );

    expect(markLocalJobConflict).toHaveBeenCalledWith(db, userId, "job-001");
    expect(markEntityMutationsConflict).toHaveBeenCalledWith(
      db,
      userId,
      "job",
      "job-001",
      "409:JOB_VERSION_CONFLICT:This job was changed on the server.",
    );
  });

  it("does not send an update without a server version", async () => {
    await expect(
      updateJobStatus("local-job-001", "in_progress", null),
    ).rejects.toThrow("JOB_SERVER_VERSION_REQUIRED");

    expect(apiPatch).not.toHaveBeenCalled();
  });

  it("returns a cached tombstone conflict after the server returns 404", async () => {
    const notFoundError = new ApiError("Job not found", 404, "JOB_NOT_FOUND");

    const deletedConflict = {
      ...serverJobs[0],
      syncStatus: "conflict" as const,
      deletedAt: "2026-10-26T12:00:00.000Z",
    };

    vi.mocked(apiGet).mockRejectedValue(notFoundError);
    vi.mocked(getLocalJobIncludingDeleted).mockResolvedValue(
      deletedConflict as never,
    );

    const result = await getJobById("job-001");

    expect(result).toEqual(deletedConflict);
    expect(getLocalJob).not.toHaveBeenCalled();
  });

  it("updates a job locally and queues the mutation while offline", async () => {
    // Setup local job + sessionMode="offline"
    // Then expect:
    // 1. updateLocalJobStatus()
    // 2. enqueueMutation()
    // 3. returned status = "in_progress"
  });

  it("reads jobs from SQLite without making an API request", async () => {
    vi.mocked(listLocalJobs).mockResolvedValue(cachedJobs as never);

    const result = await getLocalJobs();

    expect(result).toEqual(cachedJobs);
    expect(getDatabase).toHaveBeenCalled();
    expect(listLocalJobs).toHaveBeenCalledWith(expect.anything(), userId);
    expect(apiGet).not.toHaveBeenCalled();
    expect(replaceServerSnapshot).not.toHaveBeenCalled();
  });

  it("returns an empty array when SQLite has no cached jobs", async () => {
    vi.mocked(listLocalJobs).mockResolvedValue([]);

    const result = await getLocalJobs();

    expect(result).toEqual([]);
    expect(apiGet).not.toHaveBeenCalled();
  });
});
