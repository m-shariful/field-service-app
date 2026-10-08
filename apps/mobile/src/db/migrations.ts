import type { SQLiteDatabase } from "expo-sqlite";

interface Migration {
  version: number;
  description: string;
  sql: string;
}

export const migrations: Migration[] = [
  {
    version: 1,
    description: "Create local jobs table",
    sql: `
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY NOT NULL,

        user_id TEXT NOT NULL,

        title TEXT NOT NULL,
        scheduled_at TEXT NOT NULL,
        location TEXT NOT NULL,

        status TEXT NOT NULL,
        priority TEXT NOT NULL,

        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,

        server_updated_at TEXT,
        local_updated_at TEXT NOT NULL,

        sync_status TEXT NOT NULL
          CHECK (
            sync_status IN (
              'synced',
              'pending_create',
              'pending_update',
              'pending_delete',
              'conflict'
            )
          ),

        deleted_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_jobs_user_id
      ON jobs(user_id);

      CREATE INDEX IF NOT EXISTS idx_jobs_user_status
      ON jobs(user_id, status);

      CREATE INDEX IF NOT EXISTS idx_jobs_user_schedule
      ON jobs(user_id, scheduled_at);

      CREATE INDEX IF NOT EXISTS idx_jobs_sync_status
      ON jobs(sync_status);
    `,
  },
];

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const latestMigration = await db.getFirstAsync<{ version: number | null }>(`
      SELECT MAX(version) AS version
      FROM schema_migrations
    `);

  let currentVersion = latestMigration?.version ?? 0;

  const pendingMigrations = migrations
    .filter((migration) => migration.version > currentVersion)
    .sort((a, b) => a.version - b.version);

  for (const migration of pendingMigrations) {
    await db.withTransactionAsync(async () => {
      /**
       * Learning:
       *
       * This SQL is static migration SQL.
       * User-provided values never get interpolated here.
       */
      await db.execAsync(migration.sql);

      await db.runAsync(
        `
          INSERT INTO schema_migrations (
            version,
            applied_at
          )
          VALUES (?, ?)
        `,
        migration.version,
        new Date().toISOString(),
      );
    });

    currentVersion = migration.version;
  }
}
