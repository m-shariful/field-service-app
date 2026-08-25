import { useEffect, useState } from "react";
import { FlatList, SafeAreaView, StyleSheet, Text, View } from "react-native";

import { JobCard } from "@/features/jobs/JobCard";
import { getJobs } from "@/features/jobs/jobs.repository";
import { Job } from "@/features/jobs/types";

// import { mockJobs } from "@/features/jobs/mock-data";

export default function JobsScreen() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchJobs() {
      try {
        setIsLoading(true);
        setError(null);

        const data = await getJobs();

        if (isMounted) {
          setJobs(data);
        }
      } catch (error) {
        if (isMounted) {
          setError("Failed to fetch jobs. Please try again later.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchJobs();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Text>Loading jobs...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Text>{error}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Jobs</Text>

        <FlatList
          data={jobs}
          keyExtractor={(job) => job.id}
          renderItem={({ item }) => <JobCard job={item} />}
          contentContainerStyle={styles.listContent}
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
});
