import { mkdtempSync, rmSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import {
  claimNextDueMutation,
  getMutationById,
  recoverStaleSyncingMutations,
} from "../sync-queue.repository";

import { migrations } from "@/db/migrations";
import type { SQLiteDatabase } from "expo-sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

type SqliteParam = string | number | bigint | null | Uint8Array;

class NodeSQLiteAdapter {
  constructor(private readonly connection: DatabaseSync) {}

  async runAsync(sql: string, ...params: SqliteParam[]) {
    const result = this.connection.prepare(sql).run(...params);

    return {
      changes: Number(result.changes),
      lastInsertRowId: Number(result.lastInsertRowid),
    };
  }

  async getFirstAsync<T>(
    sql: string,
    ...params: SqliteParam[]
  ): Promise<T | null> {
    const result = this.connection.prepare(sql).get(...params);

    return (result as T | undefined) ?? null;
  }

  async getAllAsync<T>(sql: string, ...params: SqliteParam[]): Promise<T[]> {
    return this.connection.prepare(sql).all(...params) as T[];
  }

  async withExclusiveTransactionAsync(
    callback: (transaction: SQLiteDatabase) => Promise<void>,
  ): Promise<void> {
    this.connection.exec("BEGIN EXCLUSIVE");

    try {
      await callback(this as unknown as SQLiteDatabase);
      this.connection.exec("COMMIT");
    } catch (error) {
      this.connection.exec("ROLLBACK");
      throw error;
    }
  }

  close(): void {
    this.connection.close();
  }
}

const userId = "integration-user-001";

const fixedNow = new Date("2026-11-10T10:00:00.000Z");

const payload = {
  status: "in_progress",
  baseVersion: 3,
};

const temporaryDirectories: string[] = [];
const adapters: NodeSQLiteAdapter[] = [];

function createDatabasePair() {
  const directory = mkdtempSync(join(tmpdir(), "field-service-sync-"));

  temporaryDirectories.push(directory);

  const databasePath = join(directory, "integration.db");

  const primaryConnection = new DatabaseSync(databasePath);
  const secondaryConnection = new DatabaseSync(databasePath);

  primaryConnection.exec("PRAGMA journal_mode = WAL;");
  primaryConnection.exec("PRAGMA foreign_keys = ON;");

  const syncQueueMigration = migrations.find(
    (migration) => migration.version === 2,
  );

  if (!syncQueueMigration) {
    throw new Error("SYNC_QUEUE_MIGRATION_NOT_FOUND");
  }

  primaryConnection.exec(syncQueueMigration.sql);

  const primary = new NodeSQLiteAdapter(primaryConnection);
  const secondary = new NodeSQLiteAdapter(secondaryConnection);

  adapters.push(primary, secondary);

  return { primary, secondary };
}

function insertMutation(
  db: NodeSQLiteAdapter,
  input: {
    id: string;
    entityId: string;
    mutationId: string;
    createdAt: string;
    status?: "pending" | "retry" | "syncing";
    attemptCount?: number;
    lastAttemptAt?: string | null;
    nextAttemptAt?: string | null;
    payload?: Record<string, unknown>;
  },
): void {
  const now = fixedNow.toISOString();

  db["connection"]
    .prepare(
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
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .run(
      input.id,
      userId,
      "job",
      input.entityId,
      "update",
      JSON.stringify(input.payload ?? payload),
      input.mutationId,
      input.status ?? "pending",
      input.attemptCount ?? 0,
      input.lastAttemptAt ?? null,
      input.nextAttemptAt ?? now,
      null,
      input.createdAt,
      now,
    );
}

afterEach(() => {
  for (const adapter of adapters.splice(0)) {
    adapter.close();
  }

  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("sync queue repository - real SQLite integration", () => {
  it("prevents another connection from claiming an already claimed entity", async () => {
    const { primary, secondary } = createDatabasePair();

    insertMutation(primary, {
      id: "sync-001",
      entityId: "job-001",
      mutationId: "mutation-001",
      createdAt: "2026-11-10T08:00:00.000Z",
    });

    insertMutation(primary, {
      id: "sync-002",
      entityId: "job-001",
      mutationId: "mutation-002",
      createdAt: "2026-11-10T08:01:00.000Z",
    });

    insertMutation(primary, {
      id: "sync-003",
      entityId: "job-002",
      mutationId: "mutation-003",
      createdAt: "2026-11-10T08:02:00.000Z",
    });

    const firstClaim = await claimNextDueMutation(
      primary as unknown as SQLiteDatabase,
      userId,
      fixedNow,
    );

    const secondClaim = await claimNextDueMutation(
      secondary as unknown as SQLiteDatabase,
      userId,
      fixedNow,
    );

    expect(firstClaim?.id).toBe("sync-001");
    expect(secondClaim?.id).toBe("sync-003");

    const blockedMutation = await getMutationById(
      primary as unknown as SQLiteDatabase,
      userId,
      "mutation-002",
    );

    expect(blockedMutation?.status).toBe("pending");
    expect(blockedMutation?.attemptCount).toBe(0);
  });

  it("preserves mutation identity, payload and attempts during stale recovery", async () => {
    const { primary } = createDatabasePair();

    const originalPayload = {
      status: "completed",
      baseVersion: 7,
      notes: "Technician completed inspection",
    };

    insertMutation(primary, {
      id: "sync-stale-001",
      entityId: "job-003",
      mutationId: "mutation-stable-001",
      createdAt: "2026-11-10T07:00:00.000Z",
      status: "syncing",
      attemptCount: 4,
      lastAttemptAt: "2026-11-10T07:30:00.000Z",
      payload: originalPayload,
    });

    await recoverStaleSyncingMutations(
      primary as unknown as SQLiteDatabase,
      userId,
      new Date("2026-11-10T08:00:00.000Z"),
    );

    const recovered = await getMutationById(
      primary as unknown as SQLiteDatabase,
      userId,
      "mutation-stable-001",
    );

    expect(recovered).toEqual(
      expect.objectContaining({
        id: "sync-stale-001",
        mutationId: "mutation-stable-001",
        status: "retry",
        attemptCount: 4,
        payload: originalPayload,
        lastError: "SYNC_INTERRUPTED",
      }),
    );
  });

  it("does not recover a syncing mutation newer than the stale cutoff", async () => {
    const { primary } = createDatabasePair();

    insertMutation(primary, {
      id: "sync-active-001",
      entityId: "job-004",
      mutationId: "mutation-active-001",
      createdAt: "2026-11-10T09:00:00.000Z",
      status: "syncing",
      attemptCount: 1,
      lastAttemptAt: "2026-11-10T09:30:00.000Z",
    });

    await recoverStaleSyncingMutations(
      primary as unknown as SQLiteDatabase,
      userId,
      new Date("2026-11-10T09:00:00.000Z"),
    );

    const mutation = await getMutationById(
      primary as unknown as SQLiteDatabase,
      userId,
      "mutation-active-001",
    );

    expect(mutation?.status).toBe("syncing");
    expect(mutation?.attemptCount).toBe(1);
  });
});
