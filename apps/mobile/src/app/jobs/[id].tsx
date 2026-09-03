import {
  getJobActionLabel,
  getNextJobStatus,
} from "@/features/jobs/job-status";
import { getJobById, updateJobStatus } from "@/features/jobs/jobs.repository";
import type { Job, JobStatus } from "@/features/jobs/types";
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ApiError } from "@/api/api-error";
import { formatJobDate } from "@/features/jobs/formatters";

export default function JobDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [job, setJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadJob = useCallback(
    async (refresh = false) => {
      try {
        if (refresh) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        setError(null);

        const data = await getJobById(id);
        setJob(data);
      } catch (error) {
        setError(
          error instanceof ApiError
            ? error.message
            : "Failed to load this job.",
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [id],
  );

  useEffect(() => {
    loadJob();
  }, [loadJob]);

  async function handleStatusUpdate(status: JobStatus) {
    try {
      setIsUpdating(true);
      setError(null);

      const updatedJob = await updateJobStatus(id, status);

      setJob(updatedJob);
    } catch (error) {
      setError(
        error instanceof ApiError
          ? error.message
          : "Failed to update job status.",
      );
    } finally {
      setIsUpdating(false);
    }
  }

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: "Job Details" }} />

        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading job...</Text>
        </View>
      </>
    );
  }

  if (!job) {
    return (
      <>
        <Stack.Screen options={{ title: "Job Details" }} />

        <View style={styles.center}>
          <Text style={styles.errorTitle}>Job not found</Text>

          <Text style={styles.errorText}>
            {error ?? "The requested job could not be found."}
          </Text>

          <Pressable onPress={() => loadJob()} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      </>
    );
  }

  const nextStatus = getNextJobStatus(job.status);
  const actionLabel = getJobActionLabel(job.status);

  return (
    <>
      <Stack.Screen
        options={{
          title: "Job Details",
        }}
      />

      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadJob(true)}
            />
          }
        >
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>{job.title}</Text>

              <Text style={styles.jobId}>{job.id}</Text>
            </View>

            <PriorityBadge priority={job.priority} />
          </View>

          <View style={styles.statusCard}>
            <View>
              <Text style={styles.statusLabel}>Current status</Text>

              <Text style={styles.statusValue}>{formatStatus(job.status)}</Text>
            </View>

            <StatusIndicator status={job.status} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Job information</Text>

            <InfoRow label="Scheduled" value={formatJobDate(job.scheduledAt)} />

            <InfoRow label="Location" value={job.location} />

            <InfoRow label="Priority" value={capitalize(job.priority)} />
          </View>

          {error && (
            <View style={styles.errorCard}>
              <Text style={styles.errorCardTitle}>Something went wrong</Text>

              <Text style={styles.errorCardText}>{error}</Text>
            </View>
          )}
        </ScrollView>

        {nextStatus && actionLabel && (
          <View style={styles.actionContainer}>
            <Pressable
              disabled={isUpdating}
              // onPress={() => handleStatusUpdate(nextStatus)}
              onPress={() => {
                Alert.alert(
                  actionLabel,
                  `Are you sure you want to ${actionLabel?.toLowerCase()}?`,
                  [
                    {
                      text: "Cancel",
                      style: "cancel",
                    },
                    {
                      text: actionLabel,
                      onPress: () => handleStatusUpdate(nextStatus),
                    },
                  ],
                );
              }}
              style={({ pressed }) => [
                styles.actionButton,
                pressed && !isUpdating && styles.actionPressed,
                isUpdating && styles.actionDisabled,
              ]}
            >
              {isUpdating ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.actionText}>{actionLabel}</Text>
              )}
            </Pressable>
          </View>
        )}
      </View>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>

      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function PriorityBadge({ priority }: { priority: Job["priority"] }) {
  return (
    <View style={[styles.priorityBadge, styles[`priority_${priority}`]]}>
      <Text style={[styles.priorityText, styles[`priorityText_${priority}`]]}>
        {priority.toUpperCase()}
      </Text>
    </View>
  );
}

function StatusIndicator({ status }: { status: JobStatus }) {
  return (
    <View style={[styles.statusIndicator, styles[`statusIndicator_${status}`]]}>
      <View style={[styles.statusDot, styles[`statusDot_${status}`]]} />
    </View>
  );
}

function formatStatus(status: JobStatus) {
  switch (status) {
    case "scheduled":
      return "Scheduled";

    case "in_progress":
      return "In Progress";

    case "completed":
      return "Completed";
  }
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  content: {
    padding: 20,
    paddingBottom: 32,
  },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },

  headerText: {
    flex: 1,
  },

  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    color: "#0F172A",
  },

  jobId: {
    marginTop: 6,
    fontSize: 13,
    color: "#94A3B8",
    fontWeight: "500",
  },

  statusCard: {
    marginTop: 24,
    padding: 20,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.04,
    shadowRadius: 8,

    elevation: 2,
  },

  statusLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  statusValue: {
    marginTop: 5,
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
  },

  statusIndicator: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },

  statusIndicator_scheduled: {
    backgroundColor: "#EFF6FF",
  },

  statusIndicator_in_progress: {
    backgroundColor: "#FFF7ED",
  },

  statusIndicator_completed: {
    backgroundColor: "#F0FDF4",
  },

  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },

  statusDot_scheduled: {
    backgroundColor: "#3B82F6",
  },

  statusDot_in_progress: {
    backgroundColor: "#F97316",
  },

  statusDot_completed: {
    backgroundColor: "#22C55E",
  },

  section: {
    marginTop: 28,
    padding: 20,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  sectionTitle: {
    marginBottom: 18,
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },

  infoRow: {
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },

  infoLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },

  infoValue: {
    marginTop: 4,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "500",
    color: "#334155",
  },

  errorCard: {
    marginTop: 20,
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },

  errorCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#991B1B",
  },

  errorCardText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: "#B91C1C",
  },

  actionContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: "#F8FAFC",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },

  actionButton: {
    minHeight: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F172A",
  },

  actionPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
  },

  actionDisabled: {
    opacity: 0.55,
  },

  actionText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  priorityText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  priority_low: {
    backgroundColor: "#F1F5F9",
  },

  priority_normal: {
    backgroundColor: "#EFF6FF",
  },

  priority_high: {
    backgroundColor: "#FFF7ED",
  },

  priority_urgent: {
    backgroundColor: "#FEF2F2",
  },

  priorityText_low: {
    color: "#475569",
  },

  priorityText_normal: {
    color: "#2563EB",
  },

  priorityText_high: {
    color: "#EA580C",
  },

  priorityText_urgent: {
    color: "#DC2626",
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#F8FAFC",
  },

  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: "#64748B",
  },

  errorTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
  },

  errorText: {
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
    color: "#64748B",
  },

  retryButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#0F172A",
  },

  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
