import {
  clearUserJobs,
  getLocalJob,
  listLocalJobs,
  mapServerJobToLocalJob,
  replaceServerSnapshot,
  upsertServerJob,
} from "../local-jobs.repository";
import { describe, expect, it, vi } from "vitest";

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
});
