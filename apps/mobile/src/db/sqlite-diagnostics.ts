const SQLITE_RUNTIME_ID =
  typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `runtime-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export async function runSqliteDiagnostic<T>(
  operation: string,
  callback: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();

  console.log("[SQLite Diagnostics]", {
    event: "SQLITE_OPERATION_STARTED",
    runtimeId: SQLITE_RUNTIME_ID,
    operation,
    timestamp: new Date().toISOString(),
  });

  try {
    const result = await callback();

    console.log("[SQLite Diagnostics]", {
      event: "SQLITE_OPERATION_COMPLETED",
      runtimeId: SQLITE_RUNTIME_ID,
      operation,
      durationMs: Date.now() - startedAt,
    });

    return result;
  } catch (error) {
    console.error("[SQLite Diagnostics]", {
      event: "SQLITE_OPERATION_FAILED",
      runtimeId: SQLITE_RUNTIME_ID,
      operation,
      durationMs: Date.now() - startedAt,
      errorName: error instanceof Error ? error.name : "Unknown",
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}
