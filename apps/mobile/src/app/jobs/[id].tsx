import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { completeJob, startJob } from "@/features/jobs/job-status";

import { JobAction } from "@/features/jobs/JobAction";
import { formatJobDate } from "@/features/jobs/formatters";
import { mockJobs } from "@/features/jobs/mock-data";
import { useState } from "react";

export default function JobDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const job = mockJobs.find((item) => item.id === id);

  const [status, setStatus] = useState(job?.status ?? "scheduled");

  if (!job) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.title}>Job not found</Text>
          <Text>The requested job could not be found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  function handleStartJob() {
    setStatus((currentStatus) => startJob(currentStatus));
  }

  function handleCompleteJob() {
    setStatus((currentStatus) => completeJob(currentStatus));
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: job.title }} />

      <View style={styles.container}>
        <Text style={styles.title}>{job.title}</Text>

        <View style={styles.section}>
          <Text style={styles.label}>Status</Text>
          <Text style={styles.value}>{formatStatus(job.status)}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Priority</Text>
          <Text style={styles.value}>{job.priority}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Scheduled</Text>
          <Text style={styles.value}>{formatJobDate(job.scheduledAt)}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Location</Text>
          <Text style={styles.value}>{job.location}</Text>
        </View>
      </View>

      {/* {status === "scheduled" && (
        <Pressable onPress={handleStartJob} style={styles.actionButton}>
          <Text style={styles.actionButtonText}>Start Job</Text>
        </Pressable>
      )} */}

      {status === "scheduled" && (
        <JobAction label="Start Job" onPress={handleStartJob} />
      )}

      {status === "in_progress" && (
        <JobAction label="Complete Job" onPress={handleCompleteJob} />
      )}
    </SafeAreaView>
  );
}

function formatStatus(status: string) {
  return status.replace("_", " ");
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 24,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  value: {
    fontSize: 17,
  },
});
