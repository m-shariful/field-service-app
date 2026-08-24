import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Job } from "./types";
import { formatJobDate } from "./formatters";

interface JobCardProps {
  job: Job;
  onPress?: (job: Job) => void;
}

export function JobCard({ job, onPress }: JobCardProps) {
  return (
    <Pressable
      onPress={() => onPress?.(job)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{job.title}</Text>
        <Text style={styles.priority}>{job.priority.toUpperCase()}</Text>
      </View>

      <Text style={styles.date}>{formatJobDate(job.scheduledAt)}</Text>

      <Text style={styles.location}>{job.location}</Text>

      <View style={styles.footer}>
        <Text style={styles.status}>{formatStatus(job.status)}</Text>
      </View>
    </Pressable>
  );
}

function formatStatus(status: Job["status"]) {
  return status.replace("_", " ");
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    marginBottom: 12,
  },
  pressed: {
    opacity: 0.7,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
  },
  priority: {
    fontSize: 11,
    fontWeight: "700",
  },
  date: {
    marginTop: 8,
    fontSize: 14,
  },
  location: {
    marginTop: 4,
    fontSize: 14,
  },
  footer: {
    marginTop: 12,
  },
  status: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "capitalize",
  },
});
