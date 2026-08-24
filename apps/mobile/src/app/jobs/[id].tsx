import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";

import { mockJobs } from "@/features/jobs/mock-data";

export default function JobDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const job = mockJobs.find((item) => item.id === id);

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
          <Text style={styles.value}>{job.scheduledAt}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Location</Text>
          <Text style={styles.value}>{job.location}</Text>
        </View>
      </View>
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
