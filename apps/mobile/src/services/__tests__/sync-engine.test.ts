import { apiPatch, apiPost } from "@/api/client";
import {
  acknowledgeServerJob,
  getLocalJob,
} from "@/repositories/local-jobs.repository";
import {
  hasPendingMutationsForEntity,
  listDueMutations,
  markEntityMutationsConflict,
  updateMutationPayload,
} from "@/repositories/sync-queue.repository";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/api-error";
import { getDatabase } from "@/db/database";
import type { SyncQueueItem } from "@/db/types";
import type { Job } from "@/features/jobs/types";
import { useAuthStore } from "@/stores/auth.store";
import type { SQLiteDatabase } from "expo-sqlite";
import { syncPendingMutations } from "../sync-engine";

vi.mock("@/api/client", () => ({
  apiPatch: vi.fn(),
  apiPost: vi.fn(),
}));

vi.mock("@/db/database", () => ({
  getDatabase: vi.fn(),
}));

vi.mock("@/repositories/local-jobs.repository", () => ({
  acknowledgeServerJob: vi.fn(),
  getLocalJob: vi.fn(),
  markLocalJobConflict: vi.fn(),
}));

vi.mock("@/repositories/sync-queue.repository", () => ({
  hasPendingMutationsForEntity: vi.fn(),
  listDueMutations: vi.fn(),
  markMutationConflict: vi.fn(),
  markMutationFailed: vi.fn(),
  markMutationRetry: vi.fn(),
  markMutationSynced: vi.fn(),
  markMutationSyncing: vi.fn(),
  recoverStaleSyncingMutations: vi.fn(),
  updateMutationPayload: vi.fn(),
  markEntityMutationsConflict: vi.fn(),
}));

vi.mock("@/stores/auth.store", () => ({
  useAuthStore: {
    getState: vi.fn(),
  },
}));

const userId = "user-123";

const createdJob: Job = {
  id: "local-job-001",
  userId,
  title: "Repair generator",
  scheduledAt: "2026-10-10T10:00:00.000Z",
  location: "Rajshahi",
  status: "scheduled",
  priority: "high",
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:00:00.000Z",
  version: 1,
};

const updatedJob: Job = {
  ...createdJob,
  status: "in_progress",
  version: 2,
  updatedAt: "2026-10-02T10:00:00.000Z",
};

function makeMutation(
  overrides: Partial<SyncQueueItem> & {
    id: string;
    operation: SyncQueueItem["operation"];
    payload: Record<string, unknown>;
    mutationId?: string;
  },
): SyncQueueItem {
  return {
    id: overrides.id,
    userId,
    entityType: "job",
    entityId: createdJob.id,
    operation: overrides.operation,
    payload: overrides.payload,
    mutationId: overrides.mutationId ?? `mutation-${overrides.id}`,
    status: "pending",
    attemptCount: 0,
    lastAttemptAt: null,
    nextAttemptAt: "2026-10-01T10:00:00.000Z",
    lastError: null,
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
  };
}

describe("sync engine - versioned queued updates", () => {
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

    vi.mocked(getDatabase).mockResolvedValue({} as SQLiteDatabase);

    vi.mocked(apiPost).mockResolvedValue({
      data: createdJob,
    } as never);

    vi.mocked(apiPatch).mockResolvedValue({
      data: updatedJob,
    } as never);

    vi.mocked(getLocalJob).mockResolvedValue({
      ...createdJob,
      serverUpdatedAt: createdJob.updatedAt,
      localUpdatedAt: createdJob.updatedAt,
      syncStatus: "pending_update",
      deletedAt: null,
    } as never);

    vi.mocked(acknowledgeServerJob).mockResolvedValue({} as never);

    vi.mocked(hasPendingMutationsForEntity)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
  });

  it("resolves and persists the version for an update queued behind a create", async () => {
    const createMutation = makeMutation({
      id: "queue-create-001",
      operation: "create",
      payload: {
        id: createdJob.id,
        title: createdJob.title,
        scheduledAt: createdJob.scheduledAt,
        location: createdJob.location,
        priority: createdJob.priority,
      },
      mutationId: "mutation-create-001",
    });

    const updateMutation = makeMutation({
      id: "queue-update-001",
      operation: "update",
      payload: {
        status: "in_progress",
        baseVersion: null,
      },
      mutationId: "mutation-update-001",
    });

    vi.mocked(listDueMutations).mockResolvedValue([
      createMutation,
      updateMutation,
    ]);

    const result = await syncPendingMutations();

    expect(result.processed).toBe(2);
    expect(result.succeeded).toBe(2);
    expect(result.conflicts).toBe(0);

    expect(updateMutationPayload).toHaveBeenCalledWith(
      expect.anything(),
      userId,
      "queue-update-001",
      {
        status: "in_progress",
        baseVersion: 1,
      },
    );

    expect(apiPatch).toHaveBeenCalledWith(
      `/api/jobs/${createdJob.id}/status`,
      {
        status: "in_progress",
        baseVersion: 1,
      },
      {
        headers: {
          "Idempotency-Key": "mutation-update-001",
        },
      },
    );

    // The version must be saved before the API request begins.
    expect(
      vi.mocked(updateMutationPayload).mock.invocationCallOrder[0],
    ).toBeLessThan(vi.mocked(apiPatch).mock.invocationCallOrder[0]);
  });

  it("does not send later updates for a job after a version conflict", async () => {
    const firstMutation = makeMutation({
      id: "queue-update-conflict-001",
      operation: "update",
      payload: {
        status: "completed",
        baseVersion: 1,
      },
    });

    const laterMutation = makeMutation({
      id: "queue-update-conflict-002",
      operation: "update",
      payload: {
        status: "in_progress",
        baseVersion: 2,
      },
    });

    vi.mocked(listDueMutations).mockResolvedValue([
      firstMutation,
      laterMutation,
    ]);

    vi.mocked(apiPatch).mockRejectedValueOnce(
      new ApiError(
        "This job was changed on the server.",
        409,
        "JOB_VERSION_CONFLICT",
      ),
    );

    const result = await syncPendingMutations();

    expect(result.processed).toBe(1);
    expect(result.conflicts).toBe(1);

    // The later update must not be sent.
    expect(apiPatch).toHaveBeenCalledTimes(1);

    expect(markEntityMutationsConflict).toHaveBeenCalledWith(
      expect.anything(),
      userId,
      "job",
      firstMutation.entityId,
      "409:JOB_VERSION_CONFLICT:This job was changed on the server.",
    );
  });
});
