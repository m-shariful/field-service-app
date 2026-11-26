import {
  getNotificationPage,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/features/notifications/notifications.service";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { PushNotificationSetup } from "@/features/notifications/PushNotificationSetup";
import type { Notification } from "@/features/notifications/types";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { SafeAreaView } from "react-native-safe-area-context";

const PAGE_SIZE = 20;

function formatRelativeTime(value: string): string {
  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return "";
  }

  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - timestamp) / 1000),
  );

  if (elapsedSeconds < 60) {
    return "Just now";
  }

  const minutes = Math.floor(elapsedSeconds / 60);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);

  if (days < 7) {
    return `${days}d ago`;
  }

  return new Date(timestamp).toLocaleDateString();
}

function getNotificationLabel(type: Notification["type"]): string {
  switch (type) {
    case "JOB_STATUS_CHANGED":
      return "JOB UPDATE";
    case "JOB_REMINDER":
      return "REMINDER";
    case "JOB_OVERDUE":
      return "OVERDUE";
  }
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);

  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);

  const loadInbox = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setError(null);

      const [page, count] = await Promise.all([
        getNotificationPage({ limit: PAGE_SIZE }),
        getUnreadNotificationCount(),
      ]);

      setNotifications(page.items);
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
      setUnreadCount(count);
    } catch (loadError) {
      console.warn("Could not load notifications:", loadError);
      setError("Unable to load notifications. Please try again.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadInbox();
    }, [loadInbox]),
  );

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || isLoadingMore) {
      return;
    }

    try {
      setIsLoadingMore(true);

      const page = await getNotificationPage({
        cursor: nextCursor,
        limit: PAGE_SIZE,
      });

      setNotifications((current) => {
        const existingIds = new Set(current.map((item) => item.id));
        const newItems = page.items.filter((item) => !existingIds.has(item.id));

        return [...current, ...newItems];
      });

      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (loadError) {
      console.warn("Could not load more notifications:", loadError);
      setError("Unable to load more notifications.");
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, nextCursor, isLoadingMore]);

  const handleMarkRead = useCallback(
    async (notification: Notification) => {
      if (notification.readAt || pendingIds.has(notification.id)) {
        return;
      }

      setPendingIds((current) => {
        const next = new Set(current);
        next.add(notification.id);
        return next;
      });

      try {
        const updated = await markNotificationRead(notification.id);

        setNotifications((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );

        setUnreadCount((current) => Math.max(0, current - 1));
      } catch (markError) {
        console.warn("Could not mark notification as read:", markError);
        setError("Could not update this notification. Please try again.");
      } finally {
        setPendingIds((current) => {
          const next = new Set(current);
          next.delete(notification.id);
          return next;
        });
      }
    },
    [pendingIds],
  );

  const handleMarkAllRead = useCallback(async () => {
    if (unreadCount === 0 || isMarkingAllRead) {
      return;
    }

    try {
      setIsMarkingAllRead(true);
      setError(null);

      await markAllNotificationsRead();

      const readAt = new Date().toISOString();

      setNotifications((current) =>
        current.map((item) => (item.readAt ? item : { ...item, readAt })),
      );

      setUnreadCount(0);
    } catch (markError) {
      console.warn("Could not mark all notifications as read:", markError);
      setError("Could not update notifications. Please try again.");
    } finally {
      setIsMarkingAllRead(false);
    }
  }, [unreadCount, isMarkingAllRead]);

  const handleNotificationPress = useCallback(
    async (notification: Notification) => {
      if (!notification.readAt) {
        await handleMarkRead(notification);
      }

      if (notification.jobId) {
        router.push({
          pathname: "/jobs/[id]",
          params: { id: notification.jobId },
        });
      }
    },
    [handleMarkRead],
  );

  const renderNotification = useCallback(
    ({ item }: { item: Notification }) => {
      const isUnread = !item.readAt;
      const isPending = pendingIds.has(item.id);

      return (
        <Pressable
          onPress={() => void handleNotificationPress(item)}
          disabled={isPending}
          style={({ pressed }) => [
            styles.notificationCard,
            isUnread && styles.unreadCard,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.notificationTopRow}>
            <View style={styles.typeContainer}>
              {isUnread && <View style={styles.unreadDot} />}

              <Text style={styles.typeLabel}>
                {getNotificationLabel(item.type)}
              </Text>
            </View>

            <Text style={styles.timestamp}>
              {formatRelativeTime(item.createdAt)}
            </Text>
          </View>

          <Text style={styles.notificationTitle}>{item.title}</Text>

          <Text style={styles.notificationBody}>{item.body}</Text>

          <View style={styles.notificationFooter}>
            {item.jobId ? (
              <Text style={styles.relatedJob}>View related job →</Text>
            ) : (
              <View />
            )}

            {isPending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : isUnread ? (
              <Text style={styles.unreadLabel}>UNREAD</Text>
            ) : (
              <Text style={styles.readLabel}>READ</Text>
            )}
          </View>
        </Pressable>
      );
    },
    [handleNotificationPress, pendingIds],
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderNotification}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void loadInbox(true)}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerTopRow}>
              <View style={styles.headerTextContainer}>
                <Text style={styles.title}>Notifications</Text>
                <Text style={styles.subtitle}>
                  Stay up to date with your field work.
                </Text>
              </View>

              {unreadCount > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{unreadCount}</Text>
                </View>
              )}
            </View>

            <View style={styles.actionsRow}>
              <Text style={styles.unreadSummary}>
                {unreadCount === 0
                  ? "You're all caught up"
                  : `${unreadCount} unread ${
                      unreadCount === 1 ? "notification" : "notifications"
                    }`}
              </Text>

              {unreadCount > 0 && (
                <Pressable
                  onPress={() => void handleMarkAllRead()}
                  disabled={isMarkingAllRead}
                  hitSlop={8}
                >
                  <Text style={styles.markAllText}>
                    {isMarkingAllRead ? "Updating..." : "Mark all read"}
                  </Text>
                </Pressable>
              )}
            </View>

            <PushNotificationSetup />

            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
                <Pressable onPress={() => void loadInbox(true)}>
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
              </View>
            )}

            <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>✓</Text>
            </View>

            <Text style={styles.emptyTitle}>You're all caught up</Text>
            <Text style={styles.emptyDescription}>
              New job updates and reminders will appear here.
            </Text>
          </View>
        }
        ListFooterComponent={
          isLoadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : hasMore ? (
            <Pressable
              onPress={() => void loadMore()}
              style={styles.loadMoreButton}
            >
              <Text style={styles.loadMoreText}>Load more</Text>
            </Pressable>
          ) : notifications.length > 0 ? (
            <Text style={styles.endMessage}>You're all caught up.</Text>
          ) : null
        }
      />
    </SafeAreaView>
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
    flexGrow: 1,
  },

  header: {
    paddingTop: spacing.lg,
  },

  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  headerTextContainer: {
    flex: 1,
  },

  title: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.text.primary,
  },

  subtitle: {
    marginTop: spacing.xs,
    fontSize: 14,
    color: colors.text.secondary,
  },

  countBadge: {
    minWidth: 36,
    height: 36,
    paddingHorizontal: spacing.sm,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },

  countBadgeText: {
    color: colors.text.inverse,
    fontSize: 14,
    fontWeight: "800",
  },

  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },

  unreadSummary: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text.secondary,
  },

  markAllText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },

  sectionLabel: {
    marginBottom: spacing.md,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    color: colors.text.muted,
  },

  notificationCard: {
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  unreadCard: {
    borderColor: "#BFDBFE",
    backgroundColor: "#F8FBFF",
  },

  pressed: {
    opacity: 0.75,
  },

  notificationTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },

  typeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },

  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },

  typeLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: colors.primary,
  },

  timestamp: {
    fontSize: 11,
    color: colors.text.muted,
  },

  notificationTitle: {
    marginTop: spacing.md,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
    color: colors.text.primary,
  },

  notificationBody: {
    marginTop: spacing.xs,
    fontSize: 13,
    lineHeight: 20,
    color: colors.text.secondary,
  },

  notificationFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.lg,
  },

  relatedJob: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },

  unreadLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    color: colors.primary,
  },

  readLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: colors.text.muted,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: spacing.md,
    fontSize: 13,
    color: colors.text.secondary,
  },

  emptyState: {
    flex: 1,
    minHeight: 300,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xxl,
  },

  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ECFDF5",
  },

  emptyIconText: {
    fontSize: 28,
    fontWeight: "800",
    color: "#059669",
  },

  emptyTitle: {
    marginTop: spacing.lg,
    fontSize: 18,
    fontWeight: "800",
    color: colors.text.primary,
  },

  emptyDescription: {
    marginTop: spacing.sm,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    color: colors.text.secondary,
  },

  errorBanner: {
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderRadius: 12,
    backgroundColor: "#FEF2F2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },

  errorText: {
    flex: 1,
    fontSize: 12,
    color: "#B91C1C",
  },

  retryText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#B91C1C",
  },

  footerLoader: {
    paddingVertical: spacing.xl,
  },

  loadMoreButton: {
    alignItems: "center",
    paddingVertical: spacing.lg,
  },

  loadMoreText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },

  endMessage: {
    paddingVertical: spacing.xl,
    textAlign: "center",
    fontSize: 12,
    color: colors.text.muted,
  },
});
