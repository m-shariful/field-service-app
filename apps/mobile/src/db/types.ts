import type { SQLiteDatabase } from "expo-sqlite";

export type JobStatus = "scheduled" | "in_progress" | "completed";

export type JobPriority = "low" | "medium" | "high" | "urgent";

export type SyncStatus =
  | "synced"
  | "pending_create"
  | "pending_update"
  | "pending_delete"
  | "conflict";

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

export interface SQLiteContext {
  db: SQLiteDatabase;
}
