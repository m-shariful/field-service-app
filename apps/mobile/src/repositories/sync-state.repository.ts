import type { SyncEntityType, SyncState, SyncStateRow } from "@/db/types";

import type { SQLiteDatabase } from "expo-sqlite";

function mapRow(row: SyncStateRow): SyncState {
  return {
    userId: row.user_id,
    entityType: row.entity_type,

    cursor: row.cursor,

    updatedAt: row.updated_at,
  };
}

export async function getSyncState(
  db: SQLiteDatabase,
  userId: string,
  entityType: SyncEntityType,
): Promise<SyncState | null> {
  const row = await db.getFirstAsync<SyncStateRow>(
    `
        SELECT
          user_id,
          entity_type,
          cursor,
          updated_at
        FROM sync_state
        WHERE user_id = ?
          AND entity_type = ?
        LIMIT 1
      `,
    userId,
    entityType,
  );

  return row ? mapRow(row) : null;
}

export async function saveSyncCursor(
  db: SQLiteDatabase,
  userId: string,
  entityType: SyncEntityType,
  cursor: string | null,
): Promise<void> {
  const now = new Date().toISOString();

  await db.runAsync(
    `
      INSERT INTO sync_state (
        user_id,
        entity_type,
        cursor,
        updated_at
      )
      VALUES (?, ?, ?, ?)

      ON CONFLICT(
        user_id,
        entity_type
      )
      DO UPDATE SET
        cursor = excluded.cursor,
        updated_at = excluded.updated_at
    `,
    userId,
    entityType,
    cursor,
    now,
  );
}

export async function clearSyncState(
  db: SQLiteDatabase,
  userId: string,
): Promise<void> {
  await db.runAsync(
    `
      DELETE FROM sync_state
      WHERE user_id = ?
    `,
    userId,
  );
}
