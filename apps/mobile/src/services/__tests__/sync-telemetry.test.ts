import { afterEach, describe, expect, it, vi } from "vitest";
import {
  classifySyncError,
  createSyncRunId,
  emitSyncTelemetry,
} from "../sync-telemetry";

import { ApiError } from "@/api/api-error";

describe("sync telemetry", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("classifySyncError", () => {
    it.each([
      [new ApiError("Unauthorized", 401), "authentication"],
      [new ApiError("Forbidden", 403), "authentication"],
      [new ApiError("Version conflict", 409), "conflict"],
      [new ApiError("Bad request", 400), "client"],
      [new ApiError("Internal server error", 500), "server"],
      [new ApiError("Service unavailable", 503), "server"],
      [new Error("Network request failed"), "network"],
      [new Error("Connection timeout"), "network"],
      [new Error("Unexpected failure"), "unknown"],
    ] as const)("classifies %s correctly", (error, expectedCategory) => {
      expect(classifySyncError(error)).toBe(expectedCategory);
    });

    it("classifies abort errors as cancelled", () => {
      const error = new Error("The operation was aborted.");
      error.name = "AbortError";

      expect(classifySyncError(error)).toBe("cancelled");
    });

    it("does not expose raw error messages as categories", () => {
      const error = new Error("Sensitive server response");

      expect(classifySyncError(error)).toBe("unknown");
      expect(classifySyncError(error)).not.toContain(error.message);
    });
  });

  describe("createSyncRunId", () => {
    it("creates a non-empty unique run identifier", () => {
      const first = createSyncRunId();
      const second = createSyncRunId();

      expect(first).toBeTruthy();
      expect(second).toBeTruthy();
      expect(first).not.toBe(second);
    });
  });

  describe("emitSyncTelemetry", () => {
    it("emits a structured event", () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      emitSyncTelemetry("SYNC_RUN_STARTED", "run-123", {
        source: "manual",
      });

      expect(logSpy).toHaveBeenCalledOnce();

      const [label, event] = logSpy.mock.calls[0];

      expect(label).toBe("[Sync Telemetry]");
      expect(event).toMatchObject({
        event: "SYNC_RUN_STARTED",
        runId: "run-123",
        details: {
          source: "manual",
        },
      });

      expect((event as { timestamp: string }).timestamp).toBeTruthy();
    });

    it("does not throw when the logging destination fails", () => {
      vi.spyOn(console, "log").mockImplementation(() => {
        throw new Error("Logging unavailable");
      });

      expect(() => {
        emitSyncTelemetry("SYNC_RUN_STARTED", "run-123");
      }).not.toThrow();
    });
  });
});
