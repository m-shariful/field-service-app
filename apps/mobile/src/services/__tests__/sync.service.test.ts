import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDatabase } from "@/db/database";
import { getSyncQueueSummary } from "@/repositories/sync-queue.repository";
import { useAuthStore } from "@/stores/auth.store";
import { useSyncStore } from "@/stores/sync.store";
import { syncPendingMutations } from "../sync-engine";
import { pullJobChanges } from "../sync-pull.service";
import { syncNow } from "../sync.service";

vi.mock("../sync-engine", () => ({
  syncPendingMutations: vi.fn(),
}));

vi.mock("../sync-pull.service", () => ({
  pullJobChanges: vi.fn(),
}));

vi.mock("@/db/database", () => ({
  getDatabase: vi.fn(),
}));

vi.mock("@/repositories/sync-queue.repository", () => ({
  getSyncQueueSummary: vi.fn(),
}));

vi.mock("@/stores/auth.store", () => ({
  useAuthStore: {
    getState: vi.fn(),
  },
}));

const pushResult = {
  processed: 1,
  succeeded: 1,
  retried: 0,
  conflicts: 0,
  failed: 0,
};

const pullResult = {
  pages: 1,
  jobsApplied: 2,
  cursor: "cursor-2",
  hasMore: false,
};

describe("sync service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useSyncStore.setState({
      phase: "idle",
      connectivity: "online",
      lastSyncedAt: null,
      lastError: null,
      queueSummary: {
        queued: 0,
        conflicts: 0,
        failed: 0,
      },
    });

    vi.mocked(useAuthStore.getState).mockReturnValue({
      user: {
        id: "user-123",
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

    vi.mocked(getDatabase).mockResolvedValue({} as never);

    vi.mocked(syncPendingMutations).mockResolvedValue(pushResult);

    vi.mocked(pullJobChanges).mockResolvedValue(pullResult);

    vi.mocked(getSyncQueueSummary).mockResolvedValue({
      queued: 0,
      conflicts: 0,
      failed: 0,
    });
  });

  it("pushes, pulls, and updates visible sync state", async () => {
    vi.mocked(getSyncQueueSummary).mockResolvedValue({
      queued: 2,
      conflicts: 1,
      failed: 0,
    });

    const result = await syncNow();

    expect(result).toEqual({
      push: pushResult,
      pull: pullResult,
    });

    expect(syncPendingMutations).toHaveBeenCalledTimes(1);
    expect(pullJobChanges).toHaveBeenCalledTimes(1);

    expect(useSyncStore.getState().phase).toBe("success");

    expect(useSyncStore.getState().lastSyncedAt).not.toBeNull();

    expect(useSyncStore.getState().queueSummary).toEqual({
      queued: 2,
      conflicts: 1,
      failed: 0,
    });
  });

  it("shares one in-flight sync across concurrent callers", async () => {
    let releasePush!: (value: typeof pushResult) => void;

    vi.mocked(syncPendingMutations).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releasePush = resolve;
        }),
    );

    const first = syncNow();
    const second = syncNow();

    expect(second).toBe(first);

    releasePush(pushResult);

    await Promise.all([first, second]);

    expect(syncPendingMutations).toHaveBeenCalledTimes(1);
    expect(pullJobChanges).toHaveBeenCalledTimes(1);
  });

  it("records an orchestration failure and allows a later retry", async () => {
    vi.mocked(syncPendingMutations).mockRejectedValueOnce(
      new Error("Network request failed"),
    );

    await expect(syncNow()).rejects.toThrow("Network request failed");

    expect(useSyncStore.getState().phase).toBe("error");

    expect(useSyncStore.getState().lastError).toBe("Network request failed");

    // A failed attempt must release the single-flight lock.
    vi.mocked(syncPendingMutations).mockResolvedValueOnce(pushResult);

    await expect(syncNow()).resolves.toEqual({
      push: pushResult,
      pull: pullResult,
    });
  });

  it("does not push or pull while the session is offline", async () => {
    vi.mocked(useAuthStore.getState).mockReturnValue({
      user: {
        id: "user-123",
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

    const result = await syncNow();

    expect(result.push.succeeded).toBe(0);
    expect(result.pull.jobsApplied).toBe(0);

    expect(syncPendingMutations).not.toHaveBeenCalled();
    expect(pullJobChanges).not.toHaveBeenCalled();
  });
});
