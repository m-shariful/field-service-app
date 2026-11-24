import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";

import { syncNow } from "@/services/sync.service";
import { useAuthStore } from "@/stores/auth.store";

export const BACKGROUND_SYNC_TASK = "FIELD_SERVICE_BACKGROUND_SYNC";

/**
 * Task definitions must live at module scope.
 *
 * The OS may launch the JavaScript runtime without mounting
 * the React component tree.
 */
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  console.log("[Background Sync] Task started", {
    timestamp: new Date().toISOString(),
  });

  try {
    // Restore persisted credentials and validate the session.
    await useAuthStore.getState().initializeAuth();

    const authState = useAuthStore.getState();

    // Do not sync without a valid, online session.
    if (
      !authState.user ||
      !authState.isAuthenticated ||
      authState.sessionMode !== "online"
    ) {
      console.log("[Background Sync] Skipped: no online session");

      return BackgroundTask.BackgroundTaskResult.Success;
    }

    console.log("[Background Sync] Calling syncNow");

    const result = await syncNow();

    console.log("[Background Sync] syncNow resolved");

    const shouldRetry = result.push.retried > 0 || result.pull.hasMore;

    console.log("[Background Sync] Task completed", {
      pushProcessed: result.push.processed,
      pushRetried: result.push.retried,
      pushConflicts: result.push.conflicts,
      pushFailed: result.push.failed,
      pullPages: result.pull.pages,
      pullHasMore: result.pull.hasMore,
      shouldRetry,
    });

    /**
     * Retry only when work may make progress on another attempt.
     *
     * Conflicts and permanent failures are terminal states;
     * repeatedly scheduling them would waste background resources.
     */
    return shouldRetry
      ? BackgroundTask.BackgroundTaskResult.Failed
      : BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.error("[Background Sync] Task failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});
