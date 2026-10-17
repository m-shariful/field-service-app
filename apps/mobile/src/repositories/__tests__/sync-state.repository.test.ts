import { describe, expect, it, vi } from "vitest";
import { getSyncState, saveSyncCursor } from "../sync-state.repository";

import type { SQLiteDatabase } from "expo-sqlite";

function createFakeDatabase() {
  return {
    runAsync: vi.fn().mockResolvedValue({
      changes: 1,
    }),

    getFirstAsync: vi.fn().mockResolvedValue(null),
  } as unknown as SQLiteDatabase;
}

describe("sync state repository", () => {
  it("returns no state when the user has not synced yet", async () => {
    const db = createFakeDatabase();

    const result = await getSyncState(db, "user-123", "job");

    expect(result).toBeNull();
  });

  it("saves a cursor", async () => {
    const db = createFakeDatabase();

    await saveSyncCursor(db, "user-123", "job", "cursor-123");

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO sync_state"),
      "user-123",
      "job",
      "cursor-123",
      expect.any(String),
    );
  });

  it("reads a stored cursor", async () => {
    const db = createFakeDatabase();

    vi.mocked(db.getFirstAsync).mockResolvedValue({
      user_id: "user-123",
      entity_type: "job",
      cursor: "cursor-123",
      updated_at: "2026-10-08T10:00:00.000Z",
    });

    const result = await getSyncState(db, "user-123", "job");

    expect(result).toEqual({
      userId: "user-123",
      entityType: "job",
      cursor: "cursor-123",
      updatedAt: "2026-10-08T10:00:00.000Z",
    });
  });
});
