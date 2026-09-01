import { useCallback, useState } from "react";
import { FlatList, SafeAreaView, StyleSheet, Text, View } from "react-native";

import { JobCard } from "@/features/jobs/JobCard";
import { getJobs } from "@/features/jobs/jobs.repository";
import { Job } from "@/features/jobs/types";
import { useFocusEffect } from "expo-router";

export default function JobsScreen() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async (refresh: boolean = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(false);
      }

      setError(null);

      const data = await getJobs();
      setJobs(data);
    } catch (error) {
      setError("Failed to fetch jobs. Please try again later.");
    } finally {
      if (refresh) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchJobs();

      return undefined;
    }, [fetchJobs]),
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <Text>Loading jobs...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && jobs.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <Text>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Jobs</Text>

        {error && <Text style={styles.error}>{error}</Text>}

        <FlatList
          data={jobs}
          keyExtractor={(job) => job.id}
          renderItem={({ item }) => <JobCard job={item} />}
          contentContainerStyle={styles.listContent}
          refreshing={isRefreshing}
          onRefresh={() => fetchJobs(true)}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  title: {
    marginTop: 16,
    marginBottom: 16,
    fontSize: 30,
    fontWeight: "700",
  },
  listContent: {
    paddingBottom: 24,
  },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  error: { marginBottom: 12 },
});
