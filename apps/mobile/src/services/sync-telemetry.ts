import { ApiError } from "@/api/api-error";

export type SyncOutcome = "success" | "partial" | "failed" | "cancelled";

export type SyncErrorCategory =
  | "network"
  | "authentication"
  | "conflict"
  | "client"
  | "server"
  | "cancelled"
  | "unknown";

export interface SyncTelemetryEvent {
  event: string;
  timestamp: string;
  runId: string;
  details?: Record<string, unknown>;
}

export interface SyncRunMetrics {
  runId: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  outcome: SyncOutcome;

  push: {
    processed: number;
    succeeded: number;
    retried: number;
    conflicts: number;
    failed: number;
  };

  pull: {
    pages: number;
    jobsApplied: number;
    hasMore: boolean;
  };
}

export function createSyncRunId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `sync-run-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function classifySyncError(error: unknown): SyncErrorCategory {
  if (error instanceof Error && error.name === "AbortError") {
    return "cancelled";
  }

  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) {
      return "authentication";
    }

    if (error.status === 409) {
      return "conflict";
    }

    if (error.status >= 500) {
      return "server";
    }

    if (error.status >= 400) {
      return "client";
    }
  }

  if (
    error instanceof Error &&
    /network|fetch|connection|timeout/i.test(error.message)
  ) {
    return "network";
  }

  return "unknown";
}

/**
 * Telemetry must never interrupt synchronization.
 *
 * Do not pass mutation payloads, tokens, user details,
 * or raw error messages into telemetry events.
 */
export function emitSyncTelemetry(
  event: string,
  runId: string,
  details?: Record<string, unknown>,
): void {
  try {
    const entry: SyncTelemetryEvent = {
      event,
      timestamp: new Date().toISOString(),
      runId,
      ...(details ? { details } : {}),
    };

    console.log("[Sync Telemetry]", entry);
  } catch {
    // Telemetry is best-effort and must not affect sync.
  }
}
