import type { Job, JobStatus } from "@/features/jobs/types";
import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { JobCard } from "@/features/jobs/JobCard";
import { JobCardSkeleton } from "@/features/jobs/JobCardSkeleton";
import { getJobs } from "@/features/jobs/jobs.repository";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

type Filter = "all" | JobStatus;

const FILTERS: { label: string; value: Filter }[] = [
  { label: "All", value: "all" },
  { label: "Scheduled", value: "scheduled" },
  { label: "Active", value: "in_progress" },
  { label: "Completed", value: "completed" },
];

function getEmptyMessage(filter: Filter) {
  switch (filter) {
    case "all":
      return "There are no jobs assigned to you yet.";

    case "scheduled":
      return "You don't have any scheduled jobs.";

    case "in_progress":
      return "You don't have any active jobs.";

    case "completed":
      return "You haven't completed any jobs yet.";
  }
}

export default function JobsScreen() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setError(null);

      const data = await getJobs();
      setJobs(data);
    } catch {
      setError("Failed to fetch jobs. Please try again later.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchJobs();
    }, [fetchJobs]),
  );

  const filteredJobs = useMemo(() => {
    if (filter === "all") {
      return jobs;
    }

    return jobs.filter((job) => job.status === filter);
  }, [jobs, filter]);

  const summary = useMemo(() => {
    return {
      total: jobs.length,
      scheduled: jobs.filter((job) => job.status === "scheduled").length,
      active: jobs.filter((job) => job.status === "in_progress").length,
      completed: jobs.filter((job) => job.status === "completed").length,
    };
  }, [jobs]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          data={[1, 2, 3]}
          keyExtractor={(item) => String(item)}
          renderItem={() => <JobCardSkeleton />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.loadingHeader}>
              <View style={styles.skeletonTitle} />
              <View style={styles.skeletonSubtitle} />

              <View style={styles.summaryRow}>
                <View style={styles.summarySkeleton} />
                <View style={styles.summarySkeleton} />
                <View style={styles.summarySkeleton} />
              </View>

              <View style={styles.filterSkeletonRow}>
                <View style={styles.filterSkeleton} />
                <View style={styles.filterSkeleton} />
                <View style={styles.filterSkeleton} />
              </View>
            </View>
          }
        />
      </SafeAreaView>
    );
  }

  if (error && jobs.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Unable to load jobs</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={filteredJobs}
        keyExtractor={(job) => job.id}
        renderItem={({ item }) => <JobCard job={item} />}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => fetchJobs(true)}
          />
        }
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>Jobs</Text>
            <Text style={styles.subtitle}>Manage your field work</Text>

            <View style={styles.summaryRow}>
              <SummaryCard
                label="Total"
                value={summary.total}
                accent={colors.text.primary}
              />

              <SummaryCard
                label="Active"
                value={summary.active}
                accent={colors.status.in_progress.text}
              />

              <SummaryCard
                label="Done"
                value={summary.completed}
                accent={colors.status.completed.text}
              />
            </View>

            <Text style={styles.sectionLabel}>FILTER BY STATUS</Text>

            <View style={styles.filterContainer}>
              {FILTERS.map((item) => {
                const selected = filter === item.value;

                return (
                  <Pressable
                    key={item.value}
                    onPress={() => setFilter(item.value)}
                    style={({ pressed }) => [
                      styles.filter,
                      selected && styles.filterSelected,
                      pressed && styles.filterPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterText,
                        selected && styles.filterTextSelected,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {error && <Text style={styles.refreshError}>{error}</Text>}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No jobs found</Text>

            <Text style={styles.emptyText}>{getEmptyMessage(filter)}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

interface SummaryCardProps {
  label: string;
  value: number;
  accent: string;
}

function SummaryCard({ label, value, accent }: SummaryCardProps) {
  return (
    <View style={styles.summaryCard}>
      <View style={[styles.summaryAccent, { backgroundColor: accent }]} />

      <Text style={styles.summaryValue}>{value}</Text>

      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },

  title: {
    marginTop: spacing.lg,
    fontSize: 32,
    fontWeight: "800",
    color: colors.text.primary,
  },

  subtitle: {
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    fontSize: 15,
    color: colors.text.secondary,
  },

  sectionLabel: {
    marginBottom: spacing.sm,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    color: colors.text.muted,
  },

  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },

  summaryCard: {
    flex: 1,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  summaryValue: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text.primary,
  },

  summaryLabel: {
    marginTop: spacing.xs,
    fontSize: 12,
    fontWeight: "600",
    color: colors.text.secondary,
  },

  summaryAccent: {
    width: 28,
    height: 4,
    borderRadius: 999,
    marginBottom: spacing.md,
  },

  filterPressed: {
    opacity: 0.65,
  },

  filterContainer: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
    flexWrap: "wrap",
  },

  filter: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: "#E2E8F0",
  },

  filterSelected: {
    backgroundColor: colors.text.primary,
  },

  filterText: {
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: "600",
  },

  filterTextSelected: {
    color: colors.text.inverse,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text.primary,
  },

  errorText: {
    marginTop: spacing.sm,
    textAlign: "center",
    color: colors.text.secondary,
  },

  refreshError: {
    marginBottom: spacing.lg,
    color: "#DC2626",
    fontSize: 13,
  },

  empty: {
    alignItems: "center",
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxxl,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },

  emptyText: {
    marginTop: spacing.sm,
    textAlign: "center",
    color: colors.text.secondary,
  },

  loadingHeader: {
    marginTop: 20,
  },

  skeletonTitle: {
    width: 100,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.skeleton,
  },

  skeletonSubtitle: {
    width: 190,
    height: 14,
    marginTop: 8,
    marginBottom: 20,
    borderRadius: 6,
    backgroundColor: colors.skeleton,
  },

  summarySkeleton: {
    flex: 1,
    height: 82,
    borderRadius: 14,
    backgroundColor: colors.skeleton,
  },

  filterSkeletonRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },

  filterSkeleton: {
    width: 75,
    height: 34,
    borderRadius: 999,
    backgroundColor: colors.skeleton,
  },
});
