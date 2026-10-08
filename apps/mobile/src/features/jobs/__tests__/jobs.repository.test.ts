import { apiGet, apiPatch, apiPost } from "@/api/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createJob,
  getJobById,
  getJobs,
  updateJobStatus,
} from "../jobs.repository";
import {
  getLocalJob,
  listLocalJobs,
  replaceServerSnapshot,
  upsertServerJob,
} from "@/repositories/local-jobs.repository";

import { ApiError } from "@/api/api-error";
import type { Job } from "../types";
import { getDatabase } from "@/db/database";
import { useAuthStore } from "@/stores/auth.store";

vi.mock("@/api/client", () => ({
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
  apiPost: vi.fn(),
}));

vi.mock("@/db/database", () => ({
  getDatabase: vi.fn(),
}));

vi.mock("@/repositories/local-jobs.repository", () => ({
  getLocalJob: vi.fn(),
  listLocalJobs: vi.fn(),
  replaceServerSnapshot: vi.fn(),
  upsertServerJob: vi.fn(),
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

    vi.mocked(useAuthStore.getState).mockReturnValue({
      user: {
        id: userId,
        name: "Test User",
        email: "test@example.com",
      },
      isAuthenticated: true,
      isLoading: false,
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

    await expect(getJobById("job-missing")).rejects.toBe(notFoundError);

    expect(getLocalJob).not.toHaveBeenCalled();
  });

  it("caches a successfully updated job", async () => {
    const updatedJob = {
      ...serverJobs[0],
      status: "in_progress" as const,
    };

    vi.mocked(apiPatch).mockResolvedValue({
      data: updatedJob,
    });

    const result = await updateJobStatus(updatedJob.id, updatedJob.status);

    expect(result).toEqual(updatedJob);

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
});
