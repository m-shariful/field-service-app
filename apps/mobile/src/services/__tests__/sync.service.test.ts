import { beforeEach, describe, expect, it, vi } from "vitest";
import { cancelInFlightSync, syncNow } from "../sync.service";

import { getDatabase } from "@/db/database";
import { getSyncQueueSummary } from "@/repositories/sync-queue.repository";
import { useAuthStore } from "@/stores/auth.store";
import { useSyncStore } from "@/stores/sync.store";
import { syncPendingMutations } from "../sync-engine";
import { pullJobChanges } from "../sync-pull.service";

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

  // push retries produce partial status
  it("marks sync as partial when mutations need retry", async () => {
    useSyncStore.setState({
      lastSyncedAt: "2026-11-01T10:00:00.000Z",
    });

    vi.mocked(syncPendingMutations).mockResolvedValue({
      processed: 2,
      succeeded: 1,
      retried: 1,
      conflicts: 0,
      failed: 0,
    });

    await syncNow();

    expect(useSyncStore.getState().phase).toBe("partial");

    // A partial run must not replace the last fully successful timestamp.
    expect(useSyncStore.getState().lastSyncedAt).toBe(
      "2026-11-01T10:00:00.000Z",
    );
  });

  // conflicts produce partial status
  it("marks sync as partial when mutations have conflicts", async () => {
    vi.mocked(syncPendingMutations).mockResolvedValue({
      processed: 1,
      succeeded: 0,
      retried: 0,
      conflicts: 1,
      failed: 0,
    });

    await syncNow();

    expect(useSyncStore.getState().phase).toBe("partial");
  });

  // incomplete pull produces partial status
  it("marks sync as partial when pull has more pages remaining", async () => {
    vi.mocked(pullJobChanges).mockResolvedValue({
      pages: 20,
      jobsApplied: 1000,
      cursor: "cursor-20",
      hasMore: true,
    });

    await syncNow();

    expect(useSyncStore.getState().phase).toBe("partial");
  });

  it("cancels the shared sync operation without treating it as an error", async () => {
    vi.mocked(syncPendingMutations).mockImplementationOnce(
      (signal) =>
        new Promise((_, reject) => {
          signal?.addEventListener(
            "abort",
            () => {
              const error = new Error("The operation was aborted.");
              error.name = "AbortError";
              reject(error);
            },
            { once: true },
          );
        }),
    );

    const first = syncNow();
    const second = syncNow();

    expect(second).toBe(first);

    expect(cancelInFlightSync()).toBe(true);

    await expect(first).rejects.toMatchObject({
      name: "AbortError",
    });

    expect(pullJobChanges).not.toHaveBeenCalled();

    expect(useSyncStore.getState().phase).toBe("idle");
    expect(useSyncStore.getState().lastError).toBeNull();

    expect(cancelInFlightSync()).toBe(false);
  });
});
