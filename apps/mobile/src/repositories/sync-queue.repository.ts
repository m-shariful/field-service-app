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

/**
 * Atomically claims the next due mutation.
 *
 * Selection and status transition happen inside one exclusive
 * SQLite transaction. Concurrent workers cannot claim the same
 * pending/retry item.
 *
 * The returned item already has:
 * - status: "syncing"
 * - attemptCount: incremented
 * - lastAttemptAt: claim timestamp
 *
 * A null result means there are no due mutations.
 */
export async function claimNextDueMutation(
  db: SQLiteDatabase,
  userId: string,
  now: Date = new Date(),
): Promise<SyncQueueItem | null> {
  const nowIso = now.toISOString();

  let claimedMutation: SyncQueueItem | null = null;

  await db.withExclusiveTransactionAsync(async (transaction) => {
    const row = await transaction.getFirstAsync<SyncQueueRow>(
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
          AND NOT EXISTS (
            SELECT 1
            FROM sync_queue AS active
            WHERE active.user_id = sync_queue.user_id
              AND active.entity_type = sync_queue.entity_type
              AND active.entity_id = sync_queue.entity_id
              AND active.status = 'syncing'
          )
        ORDER BY created_at ASC, id ASC
        LIMIT 1
      `,
      userId,
      nowIso,
    );

    if (!row) {
      return;
    }

    const updateResult = await transaction.runAsync(
      `
        UPDATE sync_queue
        SET
          status = 'syncing',
          attempt_count = attempt_count + 1,
          last_attempt_at = ?,
          updated_at = ?
        WHERE id = ?
          AND user_id = ?
          AND status IN ('pending', 'retry')
      `,
      nowIso,
      nowIso,
      row.id,
      userId,
    );

    if (updateResult.changes !== 1) {
      return;
    }

    claimedMutation = mapRowToSyncQueueItem({
      ...row,
      status: "syncing",
      attempt_count: row.attempt_count + 1,
      last_attempt_at: nowIso,
      updated_at: nowIso,
    });
  });

  return claimedMutation;
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

/**
 * Persist a finalized mutation payload before making the request.
 *
 * This is important for idempotency: if the request succeeds on the
 * server but the response is lost, a retry must send the same payload.
 */
export async function updateMutationPayload(
  db: SQLiteDatabase,
  userId: string,
  queueId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const now = new Date().toISOString();

  const result = await db.runAsync(
    `
      UPDATE sync_queue
      SET
        payload_json = ?,
        updated_at = ?
      WHERE id = ?
        AND user_id = ?
        AND status = 'syncing'
    `,
    JSON.stringify(payload),
    now,
    queueId,
    userId,
  );

  if (result.changes !== 1) {
    throw new Error("SYNC_MUTATION_PAYLOAD_UPDATE_FAILED");
  }
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

/**
 * Cancellation is not a failed attempt.
 *
 * Keep the durable mutation in the queue and make it
 * immediately eligible for a future sync.
 *
 * The same mutationId is retained, so a retry remains
 * idempotent even if the server processed the request
 * before the client observed the cancellation.
 */
export async function markMutationCancelled(
  db: SQLiteDatabase,
  userId: string,
  queueId: string,
): Promise<void> {
  const now = new Date().toISOString();

  await db.runAsync(
    `
      UPDATE sync_queue
      SET
        status = 'retry',
        attempt_count = CASE
          WHEN attempt_count > 0 THEN attempt_count - 1
          ELSE 0
        END,
        next_attempt_at = ?,
        last_error = ?,
        updated_at = ?
      WHERE id = ?
        AND user_id = ?
        AND status = 'syncing'
    `,
    now,
    "SYNC_CANCELLED",
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

export async function hasPendingMutationsForEntity(
  db: SQLiteDatabase,
  userId: string,
  entityType: SyncEntityType,
  entityId: string,
): Promise<boolean> {
  const row = await db.getFirstAsync<{ count: number }>(
    `
      SELECT COUNT(*) AS count
      FROM sync_queue
      WHERE user_id = ?
        AND entity_type = ?
        AND entity_id = ?
        AND status IN (
          'pending',
          'retry',
          'syncing'
        )
    `,
    userId,
    entityType,
    entityId,
  );

  return (row?.count ?? 0) > 0;
}

export async function recoverStaleSyncingMutations(
  db: SQLiteDatabase,
  userId: string,
  staleBefore: Date,
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
      WHERE user_id = ?
        AND status = 'syncing'
        AND last_attempt_at IS NOT NULL
        AND last_attempt_at <= ?
    `,
    now,
    "SYNC_INTERRUPTED",
    now,
    userId,
    staleBefore.toISOString(),
  );
}

export async function markEntityMutationsConflict(
  db: SQLiteDatabase,
  userId: string,
  entityType: SyncEntityType,
  entityId: string,
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
      WHERE user_id = ?
        AND entity_type = ?
        AND entity_id = ?
        AND status IN (
          'pending',
          'retry',
          'syncing'
        )
    `,
    errorMessage,
    now,
    userId,
    entityType,
    entityId,
  );
}

export async function deleteConflictedMutationsForEntity(
  db: SQLiteDatabase,
  userId: string,
  entityType: SyncEntityType,
  entityId: string,
): Promise<void> {
  await db.runAsync(
    `
      DELETE FROM sync_queue
      WHERE user_id = ?
        AND entity_type = ?
        AND entity_id = ?
        AND status = 'conflict'
    `,
    userId,
    entityType,
    entityId,
  );
}

export interface SyncQueueSummary {
  queued: number;
  conflicts: number;
  failed: number;
}

export async function getSyncQueueSummary(
  db: SQLiteDatabase,
  userId: string,
): Promise<SyncQueueSummary> {
  const row = await db.getFirstAsync<{
    queued: number | null;
    conflicts: number | null;
    failed: number | null;
  }>(
    `
      SELECT
        COUNT(
          CASE
            WHEN status IN ('pending', 'retry', 'syncing')
            THEN 1
          END
        ) AS queued,

        COUNT(
          CASE WHEN status = 'conflict' THEN 1 END
        ) AS conflicts,

        COUNT(
          CASE WHEN status = 'failed' THEN 1 END
        ) AS failed

      FROM sync_queue
      WHERE user_id = ?
    `,
    userId,
  );

  return {
    queued: Number(row?.queued ?? 0),
    conflicts: Number(row?.conflicts ?? 0),
    failed: Number(row?.failed ?? 0),
  };
}

export { mapRowToSyncQueueItem };
