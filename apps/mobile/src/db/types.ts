import type { SQLiteDatabase } from "expo-sqlite";

export type JobStatus = "scheduled" | "in_progress" | "completed";

export type JobPriority = "low" | "medium" | "high" | "urgent";

export type SyncStatus =
  | "synced"
  | "pending_create"
  | "pending_update"
  | "pending_delete"
  | "conflict";

export type SyncEntityType = "job";

export type SyncOperation = "create" | "update" | "delete";

export type SyncQueueStatus =
  | "pending"
  | "syncing"
  | "retry"
  | "conflict"
  | "failed"
  | "synced";

export interface LocalJob {
  id: string;
  userId: string;

  title: string;
  scheduledAt: string;
  location: string;

  status: JobStatus;
  priority: JobPriority;

  createdAt: string;
  updatedAt: string;

  // Timestamp of the most recent server version
  serverUpdatedAt: string | null;

  // Timestamp of the latest local modification.
  localUpdatedAt: string;

  syncStatus: SyncStatus;

  // Soft-delete support for future sync.
  deletedAt: string | null;
}

export interface LocalJobRow {
  id: string;
  user_id: string;

  title: string;
  scheduled_at: string;
  location: string;

  status: JobStatus;
  priority: JobPriority;

  created_at: string;
  updated_at: string;

  server_updated_at: string | null;
  local_updated_at: string;

  sync_status: SyncStatus;

  deleted_at: string | null;
}

export interface SyncQueueItem {
  id: string;

  userId: string;

  entityType: SyncEntityType;
  entityId: string;

  operation: SyncOperation;

  /**
   * JSON-serializable mutation payload.
   *
   * Example:
   *
   * {
   *   id: "local-job-...",
   *   title: "Generator repair",
   *   ...
   * }
   */
  payload: Record<string, unknown>;

  /**
   * Stable client-generated identifier.
   *
   * This will become the server idempotency key
   * when the Sync Engine is introduced.
   */
  mutationId: string;

  status: SyncQueueStatus;

  attemptCount: number;

  lastAttemptAt: string | null;
  nextAttemptAt: string | null;

  lastError: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface SyncQueueRow {
  id: string;

  user_id: string;

  entity_type: SyncEntityType;
  entity_id: string;

  operation: SyncOperation;

  payload_json: string;

  mutation_id: string;

  status: SyncQueueStatus;

  attempt_count: number;

  last_attempt_at: string | null;
  next_attempt_at: string | null;

  last_error: string | null;

  created_at: string;
  updated_at: string;
}

export interface SQLiteContext {
  db: SQLiteDatabase;
}
