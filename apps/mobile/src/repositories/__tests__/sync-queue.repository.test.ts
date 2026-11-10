import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  claimNextDueMutation,
  countPendingMutations,
  enqueueMutation,
  getMutationById,
  listDueMutations,
  markEntityMutationsConflict,
  markMutationConflict,
  markMutationRetry,
  markMutationSynced,
  markMutationSyncing,
  recoverStaleSyncingMutations,
  updateMutationPayload,
} from "../sync-queue.repository";

import type { SQLiteDatabase } from "expo-sqlite";

function createFakeDatabase() {
  const transaction = {
    runAsync: vi.fn().mockResolvedValue({
      changes: 1,
      lastInsertRowId: 1,
    }),
    getAllAsync: vi.fn().mockResolvedValue([]),
    getFirstAsync: vi.fn().mockResolvedValue(null),
  };

  const db = {
    runAsync: vi.fn().mockResolvedValue({
      changes: 1,
      lastInsertRowId: 1,
    }),
    getAllAsync: vi.fn().mockResolvedValue([]),
    getFirstAsync: vi.fn().mockResolvedValue(null),

    withExclusiveTransactionAsync: vi.fn(
      async (callback: (tx: typeof transaction) => Promise<void>) => {
        await callback(transaction);
      },
    ),
  };

  return Object.assign(db, {
    transaction,
  }) as unknown as SQLiteDatabase & {
    transaction: typeof transaction;
  };
}

function createTransactionalFakeDatabase(row: unknown = null) {
  const transaction = {
    runAsync: vi.fn().mockResolvedValue({
      changes: 1,
      lastInsertRowId: 1,
    }),
    getFirstAsync: vi.fn().mockResolvedValue(row),
  };

  const db = {
    runAsync: vi.fn().mockResolvedValue({
      changes: 1,
      lastInsertRowId: 1,
    }),
    getAllAsync: vi.fn().mockResolvedValue([]),
    getFirstAsync: vi.fn().mockResolvedValue(null),

    withExclusiveTransactionAsync: vi.fn(
      async (callback: (tx: typeof transaction) => Promise<void>) => {
        await callback(transaction);
      },
    ),
  } as unknown as SQLiteDatabase;

  return { db, transaction };
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

  it("atomically claims the oldest due mutation", async () => {
    const db = createFakeDatabase();
    const { transaction } = db;

    transaction.getFirstAsync.mockResolvedValue({
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
      attempt_count: 2,
      last_attempt_at: null,
      next_attempt_at: "2026-10-08T09:00:00.000Z",
      last_error: null,
      created_at: "2026-10-08T09:00:00.000Z",
      updated_at: "2026-10-08T09:00:00.000Z",
    });

    const now = new Date("2026-10-08T10:00:00.000Z");

    const result = await claimNextDueMutation(db, userId, now);

    expect(db.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);

    expect(transaction.getFirstAsync).toHaveBeenCalledTimes(1);

    expect(transaction.runAsync).toHaveBeenCalledTimes(1);

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
      status: "syncing",
      attemptCount: 3,
      lastAttemptAt: now.toISOString(),
      nextAttemptAt: "2026-10-08T09:00:00.000Z",
      lastError: null,
      createdAt: "2026-10-08T09:00:00.000Z",
      updatedAt: now.toISOString(),
    });

    const [selectSql] = transaction.getFirstAsync.mock.calls[0];

    expect(selectSql).toContain("status IN ('pending', 'retry')");
    expect(selectSql).toContain("ORDER BY created_at ASC, id ASC");

    const [updateSql, ...params] = transaction.runAsync.mock.calls[0];

    expect(updateSql).toContain("status = 'syncing'");
    expect(updateSql).toContain("attempt_count = attempt_count + 1");

    expect(params).toEqual([
      now.toISOString(),
      now.toISOString(),
      "sync-001",
      userId,
    ]);
  });

  it("returns null when there are no due mutations", async () => {
    const db = createFakeDatabase();
    const { transaction } = db;

    transaction.getFirstAsync.mockResolvedValue(null);

    const result = await claimNextDueMutation(
      db,
      userId,
      new Date("2026-10-08T10:00:00.000Z"),
    );

    expect(result).toBeNull();

    expect(transaction.getFirstAsync).toHaveBeenCalledTimes(1);

    expect(transaction.runAsync).not.toHaveBeenCalled();
  });

  it("does not return a mutation when the conditional claim updates no rows", async () => {
    const db = createFakeDatabase();
    const { transaction } = db;

    transaction.getFirstAsync.mockResolvedValue({
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
      next_attempt_at: null,
      last_error: null,
      created_at: "2026-10-08T09:00:00.000Z",
      updated_at: "2026-10-08T09:00:00.000Z",
    });

    transaction.runAsync.mockResolvedValue({
      changes: 0,
      lastInsertRowId: 0,
    });

    const result = await claimNextDueMutation(db, userId);

    expect(result).toBeNull();
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

  it("persists a resolved payload before sending the mutation", async () => {
    const db = createFakeDatabase();

    const payload = {
      status: "in_progress",
      baseVersion: 1,
    };

    await updateMutationPayload(db, userId, "sync-001", payload);

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("payload_json = ?"),
      JSON.stringify(payload),
      expect.any(String),
      "sync-001",
      userId,
    );

    const [sql] = (db.runAsync as ReturnType<typeof vi.fn>).mock.calls[0];

    expect(sql).toContain("status = 'syncing'");
  });

  it("marks all active mutations for an entity as conflicted", async () => {
    const db = createFakeDatabase();
    const errorMessage =
      "409:JOB_VERSION_CONFLICT:This job was changed on the server.";

    await markEntityMutationsConflict(
      db,
      userId,
      "job",
      "job-001",
      errorMessage,
    );

    const [sql, ...params] = (db.runAsync as ReturnType<typeof vi.fn>).mock
      .calls[0];

    expect(sql).toContain("status = 'conflict'");
    expect(sql).toContain("next_attempt_at = NULL");
    expect(sql).toContain("AND entity_id = ?");
    expect(sql).toContain("'pending'");
    expect(sql).toContain("'retry'");
    expect(sql).toContain("'syncing'");

    expect(params).toEqual([
      errorMessage,
      expect.any(String),
      userId,
      "job",
      "job-001",
    ]);
  });

  it("atomically claims one due mutation and increments its attempt count", async () => {
    const row = {
      id: "sync-001",
      user_id: userId,
      entity_type: "job",
      entity_id: "job-001",
      operation: "update",
      payload_json: JSON.stringify({
        status: "in_progress",
        baseVersion: 2,
      }),
      mutation_id: "mutation-001",
      status: "retry",
      attempt_count: 2,
      last_attempt_at: null,
      next_attempt_at: "2026-10-08T09:00:00.000Z",
      last_error: "NETWORK_ERROR",
      created_at: "2026-10-08T08:00:00.000Z",
      updated_at: "2026-10-08T09:00:00.000Z",
    };

    const { db, transaction } = createTransactionalFakeDatabase(row);

    const now = new Date("2026-10-08T10:00:00.000Z");

    const result = await claimNextDueMutation(db, userId, now);

    expect(db.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);

    expect(transaction.getFirstAsync).toHaveBeenCalledTimes(1);

    expect(transaction.runAsync).toHaveBeenCalledTimes(1);

    expect(result).toEqual(
      expect.objectContaining({
        id: "sync-001",
        userId,
        entityType: "job",
        entityId: "job-001",
        operation: "update",
        mutationId: "mutation-001",
        status: "syncing",
        attemptCount: 3,
        lastAttemptAt: now.toISOString(),
        payload: {
          status: "in_progress",
          baseVersion: 2,
        },
      }),
    );

    const [selectSql, ...selectParams] =
      transaction.getFirstAsync.mock.calls[0];

    expect(selectSql).toContain("status IN ('pending', 'retry')");
    expect(selectSql).toContain("NOT EXISTS");
    expect(selectSql).toContain("active.status = 'syncing'");
    expect(selectSql).toContain("ORDER BY created_at ASC, id ASC");
    expect(selectParams).toEqual([userId, now.toISOString()]);

    const [updateSql, ...updateParams] = transaction.runAsync.mock.calls[0];

    expect(updateSql).toContain("status = 'syncing'");
    expect(updateSql).toContain("attempt_count = attempt_count + 1");
    expect(updateParams).toEqual([
      now.toISOString(),
      now.toISOString(),
      "sync-001",
      userId,
    ]);
  });

  it("does not claim a mutation when no due mutation is available", async () => {
    const { db, transaction } = createTransactionalFakeDatabase(null);

    const result = await claimNextDueMutation(
      db,
      userId,
      new Date("2026-10-08T10:00:00.000Z"),
    );

    expect(result).toBeNull();

    expect(db.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
    expect(transaction.getFirstAsync).toHaveBeenCalledTimes(1);
    expect(transaction.runAsync).not.toHaveBeenCalled();
  });

  it("recovers stale syncing mutations without changing their attempt count or payload", async () => {
    const db = createFakeDatabase();

    const staleBefore = new Date("2026-10-08T09:00:00.000Z");

    await recoverStaleSyncingMutations(db, userId, staleBefore);

    const [sql, ...params] = (db.runAsync as ReturnType<typeof vi.fn>).mock
      .calls[0];

    expect(sql).toContain("status = 'retry'");
    expect(sql).toContain("status = 'syncing'");
    expect(sql).toContain("last_attempt_at <= ?");
    expect(sql).not.toContain("attempt_count =");
    expect(sql).not.toContain("payload_json =");
    expect(sql).not.toContain("mutation_id =");

    expect(params).toEqual([
      expect.any(String),
      "SYNC_INTERRUPTED",
      expect.any(String),
      userId,
      staleBefore.toISOString(),
    ]);
  });
});
