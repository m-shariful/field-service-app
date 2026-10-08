import type {
  JobPriority,
  JobStatus,
  LocalJob,
  LocalJobRow,
  SyncStatus,
} from "../db/types";

import type { SQLiteDatabase } from "expo-sqlite";

export interface ServerJob {
  id: string;
  userId: string;

  title: string;
  scheduledAt: string;
  location: string;

  status: JobStatus;
  priority: JobPriority;

  createdAt: string;
  updatedAt: string;
}

function mapRowToLocalJob(row: LocalJobRow): LocalJob {
  return {
    id: row.id,
    userId: row.user_id,

    title: row.title,
    scheduledAt: row.scheduled_at,
    location: row.location,

    status: row.status,
    priority: row.priority,

    createdAt: row.created_at,
    updatedAt: row.updated_at,

    serverUpdatedAt: row.server_updated_at,
    localUpdatedAt: row.local_updated_at,

    syncStatus: row.sync_status,

    deletedAt: row.deleted_at,
  };
}

function mapServerJobToLocalJob(
  job: ServerJob,
  userId: string,
  localUpdatedAt = new Date().toISOString(),
): LocalJob {
  /**
   * Critical security invariant:
   *
   * A server job must belong to the currently authenticated user
   * before we persist it locally.
   */
  if (job.userId !== userId) {
    throw new Error("Cannot persist a job belonging to another user");
  }

  return {
    id: job.id,
    userId,

    title: job.title,
    scheduledAt: job.scheduledAt,
    location: job.location,

    status: job.status,
    priority: job.priority,

    createdAt: job.createdAt,
    updatedAt: job.updatedAt,

    serverUpdatedAt: job.updatedAt,
    localUpdatedAt,

    syncStatus: "synced",

    deletedAt: null,
  };
}

async function getExistingJobRow(
  db: SQLiteDatabase,
  jobId: string,
): Promise<LocalJobRow | null> {
  return db.getFirstAsync<LocalJobRow>(
    `
      SELECT
        id,
        user_id,
        title,
        scheduled_at,
        location,
        status,
        priority,
        created_at,
        updated_at,
        server_updated_at,
        local_updated_at,
        sync_status,
        deleted_at
      FROM jobs
      WHERE id = ?
      LIMIT 1
    `,
    jobId,
  );
}

export async function upsertServerJob(
  db: SQLiteDatabase,
  userId: string,
  job: ServerJob,
): Promise<LocalJob> {
  const localJob = mapServerJobToLocalJob(job, userId);

  const existing = await getExistingJobRow(db, job.id);

  /**
   * Defense-in-depth against local cross-user ID collisions.
   */
  if (existing && existing.user_id !== userId) {
    throw new Error("LOCAL_JOB_ID_BELONGS_TO_ANOTHER_USER");
  }

  /**
   * Do not allow fresh server reads to overwrite
   * local unsynchronized work.
   */
  if (existing && existing.sync_status !== "synced") {
    return mapRowToLocalJob(existing);
  }

  await db.runAsync(
    `
      INSERT INTO jobs (
        id,
        user_id,
        title,
        scheduled_at,
        location,
        status,
        priority,
        created_at,
        updated_at,
        server_updated_at,
        local_updated_at,
        sync_status,
        deleted_at
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?
      )
      ON CONFLICT(id)
      DO UPDATE SET
        user_id = excluded.user_id,
        title = excluded.title,
        scheduled_at = excluded.scheduled_at,
        location = excluded.location,
        status = excluded.status,
        priority = excluded.priority,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        server_updated_at = excluded.server_updated_at,
        local_updated_at = excluded.local_updated_at,
        sync_status = excluded.sync_status,
        deleted_at = excluded.deleted_at
      WHERE jobs.user_id = excluded.user_id
    `,
    localJob.id,
    localJob.userId,

    localJob.title,
    localJob.scheduledAt,
    localJob.location,

    localJob.status,
    localJob.priority,

    localJob.createdAt,
    localJob.updatedAt,

    localJob.serverUpdatedAt,
    localJob.localUpdatedAt,

    localJob.syncStatus,

    localJob.deletedAt,
  );

  return localJob;
}

export async function insertLocalJob(
  db: SQLiteDatabase,
  userId: string,
  job: LocalJob,
): Promise<LocalJob> {
  if (job.userId !== userId) {
    throw new Error("Cannot persist a job belonging to another user");
  }

  await db.runAsync(
    `
      INSERT INTO jobs (
        id,
        user_id,
        title,
        scheduled_at,
        location,
        status,
        priority,
        created_at,
        updated_at,
        server_updated_at,
        local_updated_at,
        sync_status,
        deleted_at
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?
      )
    `,
    job.id,
    job.userId,
    job.title,
    job.scheduledAt,
    job.location,
    job.status,
    job.priority,
    job.createdAt,
    job.updatedAt,
    job.serverUpdatedAt,
    job.localUpdatedAt,
    job.syncStatus,
    job.deletedAt,
  );

  return job;
}

export async function updateLocalJobStatus(
  db: SQLiteDatabase,
  userId: string,
  jobId: string,
  status: JobStatus,
  localUpdatedAt = new Date().toISOString(),
): Promise<LocalJob> {
  const existing = await getLocalJob(db, userId, jobId);

  if (!existing) {
    throw new Error("LOCAL_JOB_NOT_FOUND");
  }

  if (existing.syncStatus === "conflict") {
    throw new Error("LOCAL_JOB_HAS_CONFLICT");
  }

  const nextSyncStatus: SyncStatus =
    existing.syncStatus === "pending_create"
      ? "pending_create"
      : "pending_update";

  await db.runAsync(
    `
      UPDATE jobs
      SET
        status = ?,
        updated_at = ?,
        local_updated_at = ?,
        sync_status = ?
      WHERE id = ?
        AND user_id = ?
        AND deleted_at IS NULL
    `,
    status,
    localUpdatedAt,
    localUpdatedAt,
    nextSyncStatus,
    jobId,
    userId,
  );

  const updatedJob = await getLocalJob(db, userId, jobId);

  if (!updatedJob) {
    throw new Error("LOCAL_JOB_UPDATE_FAILED");
  }

  return updatedJob;
}

export async function replaceServerSnapshot(
  db: SQLiteDatabase,
  userId: string,
  jobs: ServerJob[],
): Promise<void> {
  /**
   * This method assumes GET /api/jobs returns the user's
   * complete current job collection.
   *
   * Pending/conflict local rows are preserved.
   */

  for (const job of jobs) {
    if (job.userId !== userId) {
      throw new Error("Server returned a job belonging to another user");
    }
  }

  await db.withTransactionAsync(async () => {
    /**
     * Only rows fully synchronized with the server may be
     * removed from a complete server snapshot.
     *
     * Pending local mutations must remain untouched.
     */
    await db.runAsync(
      `
        DELETE FROM jobs
        WHERE user_id = ?
          AND sync_status = 'synced'
      `,
      userId,
    );

    for (const job of jobs) {
      await upsertServerJob(db, userId, job);
    }
  });
}

export async function listLocalJobs(
  db: SQLiteDatabase,
  userId: string,
): Promise<LocalJob[]> {
  const rows = await db.getAllAsync<LocalJobRow>(
    `
      SELECT
        id,
        user_id,
        title,
        scheduled_at,
        location,
        status,
        priority,
        created_at,
        updated_at,
        server_updated_at,
        local_updated_at,
        sync_status,
        deleted_at
      FROM jobs
      WHERE user_id = ?
        AND deleted_at IS NULL
      ORDER BY scheduled_at ASC
    `,
    userId,
  );

  return rows.map(mapRowToLocalJob);
}

export async function getLocalJob(
  db: SQLiteDatabase,
  userId: string,
  jobId: string,
): Promise<LocalJob | null> {
  const row = await db.getFirstAsync<LocalJobRow>(
    `
      SELECT
        id,
        user_id,
        title,
        scheduled_at,
        location,
        status,
        priority,
        created_at,
        updated_at,
        server_updated_at,
        local_updated_at,
        sync_status,
        deleted_at
      FROM jobs
      WHERE id = ?
        AND user_id = ?
        AND deleted_at IS NULL
      LIMIT 1
    `,
    jobId,
    userId,
  );

  return row ? mapRowToLocalJob(row) : null;
}

export async function clearUserJobs(
  db: SQLiteDatabase,
  userId: string,
): Promise<void> {
  await db.runAsync(
    `
      DELETE FROM jobs
      WHERE user_id = ?
    `,
    userId,
  );
}

export { mapRowToLocalJob, mapServerJobToLocalJob };
