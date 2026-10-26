import {
  getLocalJob,
  prepareConflictedLocalJobForRetry,
  replaceConflictedLocalJobWithServer,
} from "@/repositories/local-jobs.repository";
import {
  deleteConflictedMutationsForEntity,
  enqueueMutation,
} from "@/repositories/sync-queue.repository";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiGet } from "@/api/client";
import { getDatabase } from "@/db/database";
import type { LocalJob } from "@/db/types";
import type { Job } from "@/features/jobs/types";
import { useAuthStore } from "@/stores/auth.store";
import type { SQLiteDatabase } from "expo-sqlite";
import { resolveJobConflict } from "../job-conflict-resolution.service";

vi.mock("@/api/client", () => ({
  apiGet: vi.fn(),
}));

vi.mock("@/db/database", () => ({
  getDatabase: vi.fn(),
}));

vi.mock("@/repositories/local-jobs.repository", () => ({
  getLocalJob: vi.fn(),
  prepareConflictedLocalJobForRetry: vi.fn(),
  replaceConflictedLocalJobWithServer: vi.fn(),
}));

vi.mock("@/repositories/sync-queue.repository", () => ({
  deleteConflictedMutationsForEntity: vi.fn(),
  enqueueMutation: vi.fn(),
}));

vi.mock("@/stores/auth.store", () => ({
  useAuthStore: {
    getState: vi.fn(),
  },
}));

const userId = "user-123";

const serverJob: Job = {
  id: "job-001",
  userId,
  title: "Repair generator",
  scheduledAt: "2026-10-10T10:00:00.000Z",
  location: "Rajshahi",
  status: "in_progress",
  priority: "high",
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-02T10:00:00.000Z",
  version: 2,
};

const localConflict = {
  ...serverJob,
  status: "completed" as const,
  version: 1,
  syncStatus: "conflict" as const,
} as LocalJob;

const queuedLocalJob = {
  ...localConflict,
  version: 2,
  syncStatus: "pending_update" as const,
};

function createDatabase() {
  return {
    withTransactionAsync: vi.fn(async (callback: () => Promise<void>) =>
      callback(),
    ),
  } as unknown as SQLiteDatabase;
}

describe("job conflict resolution", () => {
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
      sessionMode: "online",
      initializeAuth: vi.fn(),
      setSession: vi.fn(),
      signOut: vi.fn(),
    });

    vi.mocked(getDatabase).mockResolvedValue(createDatabase());

    vi.mocked(getLocalJob).mockResolvedValue(localConflict);

    vi.mocked(apiGet).mockResolvedValue({
      data: serverJob,
    });

    vi.mocked(prepareConflictedLocalJobForRetry).mockResolvedValue(
      queuedLocalJob,
    );

    vi.mocked(replaceConflictedLocalJobWithServer).mockResolvedValue(
      serverJob as LocalJob,
    );

    vi.mocked(enqueueMutation).mockResolvedValue({} as never);
  });

  it("accepts the server version and clears the conflicted queue", async () => {
    const result = await resolveJobConflict("job-001", "use_server");

    expect(result).toEqual(serverJob);

    expect(replaceConflictedLocalJobWithServer).toHaveBeenCalledWith(
      expect.anything(),
      userId,
      serverJob,
    );

    expect(deleteConflictedMutationsForEntity).toHaveBeenCalledWith(
      expect.anything(),
      userId,
      "job",
      "job-001",
    );
  });

  it("requeues the local final status against the latest server version", async () => {
    vi.mocked(getLocalJob)
      .mockResolvedValueOnce(localConflict)
      .mockResolvedValueOnce(queuedLocalJob);

    const result = await resolveJobConflict("job-001", "keep_local");

    expect(result.syncStatus).toBe("pending_update");

    expect(prepareConflictedLocalJobForRetry).toHaveBeenCalledWith(
      expect.anything(),
      userId,
      serverJob,
    );

    expect(enqueueMutation).toHaveBeenCalledWith(expect.anything(), {
      userId,
      entityType: "job",
      entityId: "job-001",
      operation: "update",
      payload: {
        status: "completed",
        baseVersion: 2,
      },
    });
  });

  it("does not reapply a backward status transition", async () => {
    vi.mocked(getLocalJob).mockResolvedValue({
      ...localConflict,
      status: "in_progress",
    });

    vi.mocked(apiGet).mockResolvedValue({
      data: {
        ...serverJob,
        status: "completed",
      },
    });

    await expect(resolveJobConflict("job-001", "keep_local")).rejects.toThrow(
      "JOB_CONFLICT_CHANGE_NOT_APPLICABLE",
    );

    expect(enqueueMutation).not.toHaveBeenCalled();
  });
});
