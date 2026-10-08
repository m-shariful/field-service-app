import type {
  SyncEntityType,
  SyncOperation,
  SyncQueueItem,
  SyncQueueRow,
} from "@/db/types";

import type { SQLiteDatabase } from "expo-sqlite";

function generateId(prefix: string): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function mapRowToSyncQueueItem(row: SyncQueueRow): SyncQueueItem {
  let payload: Record<string, unknown>;

  try {
    const parsed = JSON.parse(row.payload_json);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("INVALID_SYNC_PAYLOAD");
    }

    payload = parsed as Record<string, unknown>;
  } catch {
    throw new Error(`INVALID_SYNC_QUEUE_PAYLOAD:${row.id}`);
  }

  return {
    id: row.id,

    userId: row.user_id,

    entityType: row.entity_type,
    entityId: row.entity_id,

    operation: row.operation,

    payload,

    mutationId: row.mutation_id,

    status: row.status,

    attemptCount: row.attempt_count,

    lastAttemptAt: row.last_attempt_at,
    nextAttemptAt: row.next_attempt_at,

    lastError: row.last_error,

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface EnqueueMutationInput {
  userId: string;

  entityType: SyncEntityType;
  entityId: string;

  operation: SyncOperation;

  payload: Record<string, unknown>;

  mutationId?: string;
}

export async function enqueueMutation(
  db: SQLiteDatabase,
  input: EnqueueMutationInput,
): Promise<SyncQueueItem> {
  const now = new Date().toISOString();

  const queueItem: SyncQueueItem = {
    id: generateId("sync"),

    userId: input.userId,

    entityType: input.entityType,
    entityId: input.entityId,

    operation: input.operation,

    payload: input.payload,

    mutationId: input.mutationId ?? generateId("mutation"),

    status: "pending",

    attemptCount: 0,

    lastAttemptAt: null,
    nextAttemptAt: now,

    lastError: null,

    createdAt: now,
    updatedAt: now,
  };

  await db.runAsync(
    `
      INSERT INTO sync_queue (
        id,
        user_id,
        entity_type,
        entity_id,
        operation,
        payload_json,
        mutation_id,
        status,
        attempt_count,
        last_attempt_at,
        next_attempt_at,
        last_error,
        created_at,
        updated_at
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `,
    queueItem.id,
    queueItem.userId,
    queueItem.entityType,
    queueItem.entityId,
    queueItem.operation,
    JSON.stringify(queueItem.payload),
    queueItem.mutationId,
    queueItem.status,
    queueItem.attemptCount,
    queueItem.lastAttemptAt,
    queueItem.nextAttemptAt,
    queueItem.lastError,
    queueItem.createdAt,
    queueItem.updatedAt,
  );

  return queueItem;
}

export async function getMutationById(
  db: SQLiteDatabase,
  userId: string,
  mutationId: string,
): Promise<SyncQueueItem | null> {
  const row = await db.getFirstAsync<SyncQueueRow>(
    `
      SELECT
        id,
        user_id,
        entity_type,
        entity_id,
        operation,
        payload_json,
        mutation_id,
        status,
        attempt_count,
        last_attempt_at,
        next_attempt_at,
        last_error,
        created_at,
        updated_at
      FROM sync_queue
      WHERE user_id = ?
        AND mutation_id = ?
      LIMIT 1
    `,
    userId,
    mutationId,
  );

  return row ? mapRowToSyncQueueItem(row) : null;
}

export async function listDueMutations(
  db: SQLiteDatabase,
  userId: string,
  now: Date = new Date(),
  limit = 50,
): Promise<SyncQueueItem[]> {
  const nowIso = now.toISOString();

  const rows = await db.getAllAsync<SyncQueueRow>(
    `
      SELECT
        id,
        user_id,
        entity_type,
        entity_id,
        operation,
        payload_json,
        mutation_id,
        status,
        attempt_count,
        last_attempt_at,
        next_attempt_at,
        last_error,
        created_at,
        updated_at
      FROM sync_queue
      WHERE user_id = ?
        AND status IN ('pending', 'retry')
        AND (
          next_attempt_at IS NULL
          OR next_attempt_at <= ?
        )
      ORDER BY created_at ASC
      LIMIT ?
    `,
    userId,
    nowIso,
    limit,
  );

  return rows.map(mapRowToSyncQueueItem);
}

export async function countPendingMutations(
  db: SQLiteDatabase,
  userId: string,
): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    `
      SELECT COUNT(*) AS count
      FROM sync_queue
      WHERE user_id = ?
        AND status IN ('pending', 'retry', 'syncing', 'conflict')
    `,
    userId,
  );

  return row?.count ?? 0;
}

export async function markMutationSyncing(
  db: SQLiteDatabase,
  userId: string,
  queueId: string,
): Promise<void> {
  const now = new Date().toISOString();

  await db.runAsync(
    `
      UPDATE sync_queue
      SET
        status = 'syncing',
        attempt_count = attempt_count + 1,
        last_attempt_at = ?,
        updated_at = ?
      WHERE id = ?
        AND user_id = ?
    `,
    now,
    now,
    queueId,
    userId,
  );
}

export async function markMutationRetry(
  db: SQLiteDatabase,
  userId: string,
  queueId: string,
  nextAttemptAt: string,
  errorMessage: string,
): Promise<void> {
  const now = new Date().toISOString();

  await db.runAsync(
    `
      UPDATE sync_queue
      SET
        status = 'retry',
        next_attempt_at = ?,
        last_error = ?,
        updated_at = ?
      WHERE id = ?
        AND user_id = ?
    `,
    nextAttemptAt,
    errorMessage,
    now,
    queueId,
    userId,
  );
}

export async function markMutationConflict(
  db: SQLiteDatabase,
  userId: string,
  queueId: string,
  errorMessage: string,
): Promise<void> {
  const now = new Date().toISOString();

  await db.runAsync(
    `
      UPDATE sync_queue
      SET
        status = 'conflict',
        next_attempt_at = NULL,
        last_error = ?,
        updated_at = ?
      WHERE id = ?
        AND user_id = ?
    `,
    errorMessage,
    now,
    queueId,
    userId,
  );
}

export async function markMutationFailed(
  db: SQLiteDatabase,
  userId: string,
  queueId: string,
  errorMessage: string,
): Promise<void> {
  const now = new Date().toISOString();

  await db.runAsync(
    `
      UPDATE sync_queue
      SET
        status = 'failed',
        next_attempt_at = NULL,
        last_error = ?,
        updated_at = ?
      WHERE id = ?
        AND user_id = ?
    `,
    errorMessage,
    now,
    queueId,
    userId,
  );
}

export async function markMutationSynced(
  db: SQLiteDatabase,
  userId: string,
  queueId: string,
): Promise<void> {
  const now = new Date().toISOString();

  await db.runAsync(
    `
      UPDATE sync_queue
      SET
        status = 'synced',
        next_attempt_at = NULL,
        last_error = NULL,
        updated_at = ?
      WHERE id = ?
        AND user_id = ?
    `,
    now,
    queueId,
    userId,
  );
}

export async function deleteMutation(
  db: SQLiteDatabase,
  userId: string,
  queueId: string,
): Promise<void> {
  await db.runAsync(
    `
      DELETE FROM sync_queue
      WHERE id = ?
        AND user_id = ?
    `,
    queueId,
    userId,
  );
}

export { mapRowToSyncQueueItem };
