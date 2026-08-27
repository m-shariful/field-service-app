import { getJobById, updateJobStatus } from "@/features/jobs/jobs.repository";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";

import { ApiError } from "@/api/api-error";
import { JobAction } from "@/features/jobs/JobAction";
import { formatJobDate } from "@/features/jobs/formatters";
import { Job } from "@/features/jobs/types";

export default function JobDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [job, setJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadJobs() {
    try {
      setIsLoading(true);
      setError(null);

      const data = await getJobById(id);
      setJob(data);
    } catch (error) {
      setError(
        error instanceof ApiError
          ? error.message
          : "Failed to fetch job. Please try again later.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStatusUpdate(status: Job["status"]) {
    try {
      setIsUpdating(true);
      setError(null);

      const updatedJob = await updateJobStatus(id, status);
      setJob(updatedJob);
    } catch (error) {
      setError(
        error instanceof ApiError
          ? error.message
          : "Failed to update job status. Please try again later.",
      );
    } finally {
      setIsUpdating(false);
    }
  }

  useEffect(() => {
    loadJobs();
  }, [id]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.title}>Loading job...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!job) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.title}>Job not found</Text>
          <Text>{error ?? "The requested job could not be found."}</Text>
        </View>
      </SafeAreaView>
    );
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

        {error && <Text style={styles.error}>{error}</Text>}
      </View>

      {job.status === "scheduled" && (
        <JobAction
          label={isUpdating ? "Starting..." : "Start Job"}
          onPress={() => handleStatusUpdate("in_progress")}
          disabled={isUpdating}
        />
      )}

      {job.status === "in_progress" && (
        <JobAction
          label={isUpdating ? "Completing..." : "Complete Job"}
          onPress={() => handleStatusUpdate("completed")}
          disabled={isUpdating}
        />
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
  error: {
    color: "red",
    marginTop: 10,
  },
});
