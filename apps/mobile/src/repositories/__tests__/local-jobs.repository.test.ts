import { describe, expect, it, vi } from "vitest";
import {
  acknowledgeServerJob,
  applyServerJobFromPull,
  clearUserJobs,
  getLocalJob,
  listLocalJobs,
  mapServerJobToLocalJob,
  markLocalJobPendingDelete,
  replaceServerSnapshot,
  upsertServerJob,
} from "../local-jobs.repository";

import type { SQLiteDatabase } from "expo-sqlite";

const userId = "user-123";

const serverJob = {
  id: "job-001",
  userId,

  title: "Repair generator",
  scheduledAt: "2026-10-10T10:00:00.000Z",
  location: "Rajshahi",

  status: "scheduled" as const,
  priority: "high" as const,

  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:00:00.000Z",

  version: 1,
};

function createFakeDatabase() {
  const db = {
    runAsync: vi.fn().mockResolvedValue({
      changes: 1,
      lastInsertRowId: 1,
    }),

    getAllAsync: vi.fn().mockResolvedValue([]),

    getFirstAsync: vi.fn().mockResolvedValue(null),

    withTransactionAsync: vi.fn(async (callback: () => Promise<void>) =>
      callback(),
    ),

    execAsync: vi.fn().mockResolvedValue(undefined),

    closeAsync: vi.fn().mockResolvedValue(undefined),
  };

  return db as unknown as SQLiteDatabase;
}

function createPendingJobRow(overrides = {}) {
  return {
    id: "job-001",
    user_id: userId,
    title: "Repair generator",
    scheduled_at: "2026-10-10T10:00:00.000Z",
    location: "Rajshahi",
    status: "in_progress",
    priority: "high",
    created_at: "2026-10-01T10:00:00.000Z",
    updated_at: "2026-10-01T10:00:00.000Z",
    server_updated_at: "2026-10-01T10:00:00.000Z",
    server_version: 1,
    local_updated_at: "2026-10-02T10:00:00.000Z",
    sync_status: "pending_update",
    deleted_at: null,
    ...overrides,
  };
}

describe("local jobs repository", () => {
  it("maps a server job into a local job", () => {
    const result = mapServerJobToLocalJob(
      serverJob,
      userId,
      "2026-10-01T12:00:00.000Z",
    );

    expect(result).toEqual({
      id: "job-001",
      userId: "user-123",

      title: "Repair generator",
      scheduledAt: "2026-10-10T10:00:00.000Z",
      location: "Rajshahi",

      status: "scheduled",
      priority: "high",

      createdAt: "2026-10-01T10:00:00.000Z",
      updatedAt: "2026-10-01T10:00:00.000Z",

      serverUpdatedAt: "2026-10-01T10:00:00.000Z",

      localUpdatedAt: "2026-10-01T12:00:00.000Z",

      syncStatus: "synced",
      deletedAt: null,
      version: 1,
    });
  });

  it("rejects a job belonging to another user", () => {
    expect(() =>
      mapServerJobToLocalJob(
        {
          ...serverJob,
          userId: "another-user",
        },
        userId,
      ),
    ).toThrow("Cannot persist a job belonging to another user");
  });

  it("upserts a server job", async () => {
    const db = createFakeDatabase();

    await upsertServerJob(db, userId, serverJob);

    expect(db.runAsync).toHaveBeenCalledTimes(1);

    const [sql, ...params] = (db.runAsync as ReturnType<typeof vi.fn>).mock
      .calls[0];

    expect(sql).toContain("ON CONFLICT(id)");

    expect(params[0]).toBe("job-001");
    expect(params[1]).toBe(userId);
  });

  it("lists local jobs for only the current user", async () => {
    const db = createFakeDatabase();

    (db.getAllAsync as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "job-001",
        user_id: userId,

        title: "Repair generator",
        scheduled_at: "2026-10-10T10:00:00.000Z",
        location: "Rajshahi",

        status: "scheduled",
        priority: "high",

        created_at: "2026-10-01T10:00:00.000Z",
        updated_at: "2026-10-01T10:00:00.000Z",

        server_updated_at: "2026-10-01T10:00:00.000Z",
        local_updated_at: "2026-10-01T12:00:00.000Z",

        sync_status: "synced",
        deleted_at: null,
      },
    ]);

    const jobs = await listLocalJobs(db, userId);

    expect(db.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("WHERE user_id = ?"),
      userId,
    );

    expect(jobs).toHaveLength(1);
    expect(jobs[0].id).toBe("job-001");
  });

  it("returns a single local job", async () => {
    const db = createFakeDatabase();

    (db.getFirstAsync as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "job-001",
      user_id: userId,

      title: "Repair generator",
      scheduled_at: "2026-10-10T10:00:00.000Z",
      location: "Rajshahi",

      status: "scheduled",
      priority: "high",

      created_at: "2026-10-01T10:00:00.000Z",
      updated_at: "2026-10-01T10:00:00.000Z",

      server_updated_at: "2026-10-01T10:00:00.000Z",
      local_updated_at: "2026-10-01T12:00:00.000Z",

      sync_status: "synced",
      deleted_at: null,
    });

    const job = await getLocalJob(db, userId, "job-001");

    expect(job?.id).toBe("job-001");
    expect(job?.userId).toBe(userId);
  });

  it("clears only the current user's jobs", async () => {
    const db = createFakeDatabase();

    await clearUserJobs(db, userId);

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM jobs"),
      userId,
    );
  });

  it("replaces a complete server snapshot atomically", async () => {
    const db = createFakeDatabase();

    await replaceServerSnapshot(db, userId, [serverJob]);

    expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);

    expect(db.runAsync).toHaveBeenCalled();
  });

  it("stores the latest server version during pull without overwriting local edits", async () => {
    const db = createFakeDatabase();

    const incomingJob = {
      ...serverJob,
      status: "scheduled" as const,
      updatedAt: "2026-10-03T10:00:00.000Z",
      version: 2,
    };

    const getFirstAsyncMock = db.getFirstAsync as unknown as ReturnType<
      typeof vi.fn
    >;

    getFirstAsyncMock
      .mockResolvedValueOnce(createPendingJobRow())
      .mockResolvedValueOnce(
        createPendingJobRow({
          server_updated_at: incomingJob.updatedAt,
          server_version: 2,
        }),
      );

    const result = await applyServerJobFromPull(db, userId, incomingJob);

    const runAsyncMock = db.runAsync as unknown as ReturnType<typeof vi.fn>;

    const pullSql = String(runAsyncMock.mock.calls[0][0]);

    expect(pullSql).toMatch(
      /server_updated_at\s*=\s*\?,\s*server_version\s*=\s*\?/,
    );

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("server_version = ?"),
      incomingJob.updatedAt,
      2,
      incomingJob.id,
      userId,
    );

    // Local unsynchronized state must remain visible.
    expect(result.status).toBe("in_progress");
    expect(result.syncStatus).toBe("pending_update");

    // The latest server revision must be preserved.
    expect(result.version).toBe(2);
  });

  it("stores the acknowledged server version when more mutations remain", async () => {
    const db = createFakeDatabase();

    const acknowledgedJob = {
      ...serverJob,
      status: "in_progress" as const,
      updatedAt: "2026-10-03T11:00:00.000Z",
      version: 2,
    };

    const getFirstAsyncMock = db.getFirstAsync as unknown as ReturnType<
      typeof vi.fn
    >;

    getFirstAsyncMock
      .mockResolvedValueOnce(
        createPendingJobRow({
          status: "completed",
          server_version: 1,
        }),
      )
      .mockResolvedValueOnce(
        createPendingJobRow({
          status: "completed",
          server_updated_at: acknowledgedJob.updatedAt,
          server_version: 2,
          sync_status: "pending_update",
        }),
      );

    const result = await acknowledgeServerJob(
      db,
      userId,
      acknowledgedJob,
      true,
    );

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("server_version = ?"),
      acknowledgedJob.createdAt,
      acknowledgedJob.updatedAt,
      2,
      acknowledgedJob.id,
      userId,
    );

    // Keep the later local mutation visible.
    expect(result.status).toBe("completed");
    expect(result.syncStatus).toBe("pending_update");

    // Save the revision returned by the server.
    expect(result.version).toBe(2);
  });

  it("marks a synced job for deletion without physically removing it", async () => {
    const db = createFakeDatabase();

    const getFirstAsyncMock = db.getFirstAsync as unknown as ReturnType<
      typeof vi.fn
    >;

    getFirstAsyncMock
      .mockResolvedValueOnce(
        createPendingJobRow({
          sync_status: "synced",
          server_version: 1,
          deleted_at: null,
        }),
      )
      .mockResolvedValueOnce(
        createPendingJobRow({
          sync_status: "pending_delete",
          server_version: 1,
          deleted_at: "2026-10-26T10:00:00.000Z",
        }),
      );

    const result = await markLocalJobPendingDelete(db, userId, "job-001");

    expect(result.syncStatus).toBe("pending_delete");
    expect(result.deletedAt).toEqual(expect.any(String));
    expect(result.version).toBe(1);

    const runAsyncMock = db.runAsync as unknown as ReturnType<typeof vi.fn>;

    const [sql] = runAsyncMock.mock.calls[0];

    expect(sql).toContain("deleted_at = ?");
    expect(sql).toContain("sync_status = 'pending_delete'");
    expect(sql).not.toContain("DELETE FROM jobs");
  });
});
