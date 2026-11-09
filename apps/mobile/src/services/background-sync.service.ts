import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";

import { BACKGROUND_SYNC_TASK } from "@/tasks/background-sync.task";

let registrationPromise: Promise<void> | null = null;
let unregistrationPromise: Promise<void> | null = null;

export async function registerBackgroundSync(): Promise<void> {
  if (registrationPromise) {
    return registrationPromise;
  }

  const operation = (async () => {
    const status = await BackgroundTask.getStatusAsync();

    if (status !== BackgroundTask.BackgroundTaskStatus.Available) {
      console.warn("[Background Sync] Background execution is unavailable", {
        status,
      });
      return;
    }

    const isRegistered =
      await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);

    if (isRegistered) {
      console.log("[Background Sync] Already registered");
      return;
    }

    await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: 15,
    });

    console.log("[Background Sync] Registered successfully");
  })();

  registrationPromise = operation;

  try {
    await operation;
  } finally {
    if (registrationPromise === operation) {
      registrationPromise = null;
    }
  }
}

export async function unregisterBackgroundSync(): Promise<void> {
  if (unregistrationPromise) {
    return unregistrationPromise;
  }

  const operation = (async () => {
    const isRegistered =
      await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);

    if (!isRegistered) {
      return;
    }

    await BackgroundTask.unregisterTaskAsync(BACKGROUND_SYNC_TASK);

    console.log("[Background Sync] Unregistered successfully");
  })();

  unregistrationPromise = operation;

  try {
    await operation;
  } finally {
    if (unregistrationPromise === operation) {
      unregistrationPromise = null;
    }
  }
}

export async function triggerBackgroundSyncForTesting(): Promise<boolean> {
  if (!__DEV__) {
    return false;
  }

  const isRegistered =
    await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);

  console.log("[Background Sync] Registered:", isRegistered);

  if (!isRegistered) {
    throw new Error("Background sync task is not registered.");
  }

  const triggered = await BackgroundTask.triggerTaskWorkerForTestingAsync();

  console.log("[Background Sync] Native trigger result:", triggered);

  return triggered;
}
