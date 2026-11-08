import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { syncNow } from "@/services/sync.service";
import { useAuthStore } from "@/stores/auth.store";
import { useSyncStore } from "@/stores/sync.store";

function formatLastSync(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString();
}

interface SyncStatusCardProps {
  onSyncFinished: () => void | Promise<void>;
}

export function SyncStatusCard({ onSyncFinished }: SyncStatusCardProps) {
  const phase = useSyncStore((state) => state.phase);
  const connectivity = useSyncStore((state) => state.connectivity);
  const lastSyncedAt = useSyncStore((state) => state.lastSyncedAt);
  const lastError = useSyncStore((state) => state.lastError);
  const queueSummary = useSyncStore((state) => state.queueSummary);

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const sessionMode = useAuthStore((state) => state.sessionMode);

  const isOffline = connectivity === "offline" || sessionMode === "offline";

  const isSyncing = phase === "syncing";

  const canSync =
    isAuthenticated &&
    sessionMode === "online" &&
    connectivity !== "offline" &&
    !isSyncing;

  let title = "Ready to sync";
  let description = "Your jobs will sync automatically when possible.";

  if (isOffline) {
    title = "Offline — changes are saved locally";

    description =
      connectivity === "online"
        ? "Restoring your online session before syncing."
        : "Your local jobs and queued changes remain on this device.";
  } else if (isSyncing) {
    title = "Syncing your jobs";
    description = "Sending local changes and checking for server updates.";
  } else if (queueSummary.conflicts > 0) {
    title = "Changes need your attention";
    description = "Open a conflicted job to review and resolve its changes.";
  } else if (queueSummary.failed > 0) {
    title = "Some changes failed to sync";
    description =
      "Review the sync details and retry after correcting the issue.";
  } else if (queueSummary.queued > 0) {
    title = "Changes waiting to sync";
    description = "Pending changes will be retried when synchronization runs.";
  } else if (phase === "partial") {
    title = "Sync partially completed";
    description =
      "Some changes remain pending, or more server updates need to be downloaded.";
  } else if (phase === "error") {
    title = "Sync could not finish";
    description = lastError ?? "Check your connection, then try again.";
  } else if (phase === "success") {
    title = "All caught up";
    description = "The latest synchronization run completed.";
  }

  const lastSyncLabel = formatLastSync(lastSyncedAt);

  return (
    <View style={styles.card}>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>

        <Text style={styles.description}>{description}</Text>

        <Text style={styles.queueSummary}>
          Waiting: {queueSummary.queued} · Conflicts: {queueSummary.conflicts} ·
          Failed: {queueSummary.failed}
        </Text>

        {lastSyncLabel && (
          <Text style={styles.lastSync}>
            Last successful sync: {lastSyncLabel}
          </Text>
        )}

        {!isOffline && lastError && (
          <Text style={styles.errorText}>{lastError}</Text>
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Synchronize jobs now"
        disabled={!canSync}
        onPress={() => {
          void (async () => {
            try {
              await syncNow();
            } catch (error) {
              // The sync store exposes the error to the user.
              console.warn("Synchronization failed:", error);
            } finally {
              await onSyncFinished();
            }
          })();
        }}
        style={({ pressed }) => [
          styles.button,
          (!canSync || pressed) && styles.buttonDisabled,
        ]}
      >
        {isSyncing ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>
            {isOffline ? "Offline" : "Sync now"}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 22,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },

  content: {
    flex: 1,
  },

  title: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },

  description: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 18,
    color: "#334155",
  },

  queueSummary: {
    marginTop: 9,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700",
    color: "#475569",
  },

  lastSync: {
    marginTop: 5,
    fontSize: 11,
    color: "#64748B",
  },

  errorText: {
    marginTop: 6,
    fontSize: 11,
    lineHeight: 16,
    color: "#B91C1C",
  },

  button: {
    minHeight: 40,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#0F172A",
  },

  buttonDisabled: {
    opacity: 0.45,
  },

  buttonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
