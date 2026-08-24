import { FlatList, SafeAreaView, StyleSheet, Text, View } from "react-native";

import { JobCard } from "@/features/jobs/JobCard";
import { mockJobs } from "@/features/jobs/mock-data";

export default function JobsScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Jobs</Text>

        <FlatList
          data={mockJobs}
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
