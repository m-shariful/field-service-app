import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Job, JobPriority, JobStatus } from "./types";

import { router } from "expo-router";
import { formatJobDate } from "./formatters";

interface JobCardProps {
  job: Job;
}

export function JobCard({ job }: JobCardProps) {
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/jobs/[id]",
          params: {
            id: job.id,
          },
        })
      }
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.topRow}>
        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={2}>
            {job.title}
          </Text>

          <Text style={styles.jobId}>{job.id}</Text>
        </View>

        <PriorityBadge priority={job.priority} />
      </View>

      <View style={styles.divider} />

      <View style={styles.infoRow}>
        <Text style={styles.infoIcon}>◷</Text>

        <View>
          <Text style={styles.infoLabel}>Scheduled</Text>
          <Text style={styles.infoValue}>{formatJobDate(job.scheduledAt)}</Text>
        </View>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.infoIcon}>⌖</Text>

        <View style={styles.locationContainer}>
          <Text style={styles.infoLabel}>Location</Text>
          <Text style={styles.infoValue} numberOfLines={1}>
            {job.location}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <StatusBadge status={job.status} />

        <Text style={styles.viewText}>View details →</Text>
      </View>
    </Pressable>
  );
}

function PriorityBadge({ priority }: { priority: JobPriority }) {
  return (
    <View style={[styles.priorityBadge, styles[`priority_${priority}`]]}>
      <Text style={[styles.priorityText, styles[`priorityText_${priority}`]]}>
        {priority.toUpperCase()}
      </Text>
    </View>
  );
}

function StatusBadge({ status }: { status: JobStatus }) {
  const label = formatStatus(status);

  return (
    <View style={[styles.statusBadge, styles[`status_${status}`]]}>
      <View style={[styles.statusDot, styles[`statusDot_${status}`]]} />

      <Text style={[styles.statusText, styles[`statusText_${status}`]]}>
        {label}
      </Text>
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

const styles = StyleSheet.create({
  card: {
    marginBottom: 14,
    padding: 18,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",

    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,

    elevation: 2,
  },

  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },

  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },

  titleContainer: {
    flex: 1,
  },

  title: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "700",
    color: "#0F172A",
  },

  jobId: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "500",
    color: "#94A3B8",
  },

  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 16,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  infoIcon: {
    width: 28,
    fontSize: 18,
    color: "#64748B",
  },

  infoLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  infoValue: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: "500",
    color: "#334155",
  },

  locationContainer: {
    flex: 1,
  },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },

  viewText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },

  priorityBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
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

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  statusDot: {
    width: 7,
    height: 7,
    marginRight: 7,
    borderRadius: 999,
  },

  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },

  status_scheduled: {
    backgroundColor: "#EFF6FF",
  },

  status_in_progress: {
    backgroundColor: "#FFF7ED",
  },

  status_completed: {
    backgroundColor: "#F0FDF4",
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

  statusText_scheduled: {
    color: "#2563EB",
  },

  statusText_in_progress: {
    color: "#EA580C",
  },

  statusText_completed: {
    color: "#16A34A",
  },
});
