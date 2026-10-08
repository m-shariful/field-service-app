import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  countPendingMutations,
  enqueueMutation,
  getMutationById,
  listDueMutations,
  markMutationConflict,
  markMutationRetry,
  markMutationSynced,
  markMutationSyncing,
} from "../sync-queue.repository";

import type { SQLiteDatabase } from "expo-sqlite";

function createFakeDatabase() {
  return {
    runAsync: vi.fn().mockResolvedValue({
      changes: 1,
      lastInsertRowId: 1,
    }),

    getAllAsync: vi.fn().mockResolvedValue([]),

    getFirstAsync: vi.fn().mockResolvedValue(null),
  } as unknown as SQLiteDatabase;
}

const userId = "user-123";

describe("sync queue repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enqueues a mutation", async () => {
    const db = createFakeDatabase();

    const result = await enqueueMutation(db, {
      userId,

      entityType: "job",
      entityId: "job-001",

      operation: "update",

      payload: {
        status: "in_progress",
      },

      mutationId: "mutation-001",
    });

    expect(result.userId).toBe(userId);
    expect(result.entityId).toBe("job-001");
    expect(result.operation).toBe("update");
    expect(result.mutationId).toBe("mutation-001");
    expect(result.status).toBe("pending");

    expect(db.runAsync).toHaveBeenCalledTimes(1);

    const [sql, ...params] = (db.runAsync as ReturnType<typeof vi.fn>).mock
      .calls[0];

    expect(sql).toContain("INSERT INTO sync_queue");
    expect(params).toContain(userId);
    expect(params).toContain("mutation-001");
  });

  it("reads a mutation by mutation id", async () => {
    const db = createFakeDatabase();

    (db.getFirstAsync as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "sync-001",
      user_id: userId,
      entity_type: "job",
      entity_id: "job-001",
      operation: "update",
      payload_json: JSON.stringify({
        status: "in_progress",
      }),
      mutation_id: "mutation-001",
      status: "pending",
      attempt_count: 0,
      last_attempt_at: null,
      next_attempt_at: "2026-10-08T10:00:00.000Z",
      last_error: null,
      created_at: "2026-10-08T10:00:00.000Z",
      updated_at: "2026-10-08T10:00:00.000Z",
    });

    const result = await getMutationById(db, userId, "mutation-001");

    expect(result).toEqual({
      id: "sync-001",
      userId,
      entityType: "job",
      entityId: "job-001",
      operation: "update",
      payload: {
        status: "in_progress",
      },
      mutationId: "mutation-001",
      status: "pending",
      attemptCount: 0,
      lastAttemptAt: null,
      nextAttemptAt: "2026-10-08T10:00:00.000Z",
      lastError: null,
      createdAt: "2026-10-08T10:00:00.000Z",
      updatedAt: "2026-10-08T10:00:00.000Z",
    });
  });

  it("lists due pending mutations in creation order", async () => {
    const db = createFakeDatabase();

    (db.getAllAsync as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "sync-001",
        user_id: userId,
        entity_type: "job",
        entity_id: "job-001",
        operation: "update",
        payload_json: JSON.stringify({
          status: "in_progress",
        }),
        mutation_id: "mutation-001",
        status: "pending",
        attempt_count: 0,
        last_attempt_at: null,
        next_attempt_at: "2026-10-08T09:00:00.000Z",
        last_error: null,
        created_at: "2026-10-08T09:00:00.000Z",
        updated_at: "2026-10-08T09:00:00.000Z",
      },
    ]);

    const result = await listDueMutations(
      db,
      userId,
      new Date("2026-10-08T10:00:00.000Z"),
    );

    expect(result).toHaveLength(1);
    expect(result[0].mutationId).toBe("mutation-001");
    expect(result[0].payload.status).toBe("in_progress");
  });

  it("counts pending mutations", async () => {
    const db = createFakeDatabase();

    (db.getFirstAsync as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 3,
    });

    const count = await countPendingMutations(db, userId);

    expect(count).toBe(3);
  });

  it("marks a mutation as syncing", async () => {
    const db = createFakeDatabase();

    await markMutationSyncing(db, userId, "sync-001");

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("status = 'syncing'"),
      expect.any(String),
      expect.any(String),
      "sync-001",
      userId,
    );
  });

  it("marks a mutation for retry", async () => {
    const db = createFakeDatabase();

    await markMutationRetry(
      db,
      userId,
      "sync-001",
      "2026-10-08T10:05:00.000Z",
      "NETWORK_ERROR",
    );

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("status = 'retry'"),
      "2026-10-08T10:05:00.000Z",
      "NETWORK_ERROR",
      expect.any(String),
      "sync-001",
      userId,
    );
  });

  it("marks a mutation as conflict", async () => {
    const db = createFakeDatabase();

    await markMutationConflict(db, userId, "sync-001", "VERSION_CONFLICT");

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("status = 'conflict'"),
      "VERSION_CONFLICT",
      expect.any(String),
      "sync-001",
      userId,
    );
  });

  it("marks a mutation as synced", async () => {
    const db = createFakeDatabase();

    await markMutationSynced(db, userId, "sync-001");

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("status = 'synced'"),
      expect.any(String),
      "sync-001",
      userId,
    );
  });
});
