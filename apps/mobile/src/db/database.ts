import * as SQLite from "expo-sqlite";

import { Platform } from "react-native";
import { runMigrations } from "./migrations";

const DATABASE_NAME = "field-service.db";

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function initializeDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);

  /**
   * Learning:
   *
   * WAL improves SQLite write/read concurrency and is useful
   * for mobile local persistence.
   *
   * We avoid applying mobile-specific PRAGMA configuration
   * blindly to web because expo-sqlite web support needs
   * additional WASM/header configuration.
   */
  if (Platform.OS !== "web") {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
    `);
  }

  await runMigrations(db);

  return db;
}

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = initializeDatabase();
  }

  return databasePromise;
}

export async function closeDatabase(): Promise<void> {
  if (!databasePromise) {
    return;
  }

  const db = await databasePromise;

  await db.closeAsync();

  databasePromise = null;
}
