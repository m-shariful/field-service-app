import type { SyncQueueSummary } from "@/repositories/sync-queue.repository";
import type { SyncRunMetrics } from "@/services/sync-telemetry";
import { create } from "zustand";

export type ConnectivityStatus = "unknown" | "online" | "offline";

export type SyncPhase = "idle" | "syncing" | "success" | "partial" | "error";

const EMPTY_QUEUE_SUMMARY: SyncQueueSummary = {
  queued: 0,
  conflicts: 0,
  failed: 0,
};

interface SyncState {
  phase: SyncPhase;
  connectivity: ConnectivityStatus;
  lastSyncedAt: string | null;
  lastError: string | null;
  queueSummary: SyncQueueSummary;
  lastRunMetrics: SyncRunMetrics | null;

  setConnectivity: (status: ConnectivityStatus) => void;
  setQueueSummary: (summary: SyncQueueSummary) => void;
  setLastRunMetrics: (metrics: SyncRunMetrics) => void;
  startSync: () => void;
  finishSync: (completedAt: string) => void;
  failSync: (message: string) => void;
  finishPartialSync: () => void;
  cancelSync: () => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  phase: "idle",
  connectivity: "unknown",
  lastSyncedAt: null,
  lastError: null,
  queueSummary: EMPTY_QUEUE_SUMMARY,
  lastRunMetrics: null,

  setConnectivity: (connectivity) => set({ connectivity }),

  setQueueSummary: (queueSummary) => set({ queueSummary }),

  setLastRunMetrics: (lastRunMetrics) => set({ lastRunMetrics }),

  startSync: () =>
    set({
      phase: "syncing",
      lastError: null,
    }),

  finishSync: (lastSyncedAt) =>
    set({
      phase: "success",
      lastSyncedAt,
      lastError: null,
    }),

  failSync: (lastError) =>
    set({
      phase: "error",
      lastError,
    }),

  finishPartialSync: () =>
    set({
      phase: "partial",
      lastError: null,
    }),

  cancelSync: () =>
    set({
      phase: "idle",
      lastError: null,
    }),
}));
