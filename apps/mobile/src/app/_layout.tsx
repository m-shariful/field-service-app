import * as Network from "expo-network";

import { Stack, router, usePathname } from "expo-router";
import { ActivityIndicator, AppState, StyleSheet, View } from "react-native";

import { syncNow } from "@/services/sync.service";
import { useAuthStore } from "@/stores/auth.store";
import { useSyncStore } from "@/stores/sync.store";
import { colors } from "@/theme";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

function logSyncTrigger(trigger: string, details?: Record<string, unknown>) {
  console.log("[Sync Diagnostics]", {
    timestamp: new Date().toISOString(),
    trigger,
    ...details,
  });
}

export default function RootLayout() {
  const pathname = usePathname();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const initializeAuth = useAuthStore((state) => state.initializeAuth);

  // Get the current session mode from the auth store
  const sessionMode = useAuthStore((state) => state.sessionMode);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const isPublicRoute = pathname === "/login" || pathname === "/register";

    if (!isAuthenticated && !isPublicRoute) {
      router.replace("/login");
      return;
    }

    if (isAuthenticated && isPublicRoute) {
      router.replace("/");
    }
  }, [isAuthenticated, isLoading, pathname]);

  // Sync pending mutations in the background when the user is authenticated and online.
  // useEffect(() => {
  //   if (!isAuthenticated || sessionMode !== "online") {
  //     return;
  //   }

  //   void syncNow().catch((error) => {
  //     console.warn("Synchronization failed:", error);
  //   });
  // }, [isAuthenticated, sessionMode]);

  useEffect(() => {
    if (!isAuthenticated || sessionMode === "signed_out") {
      useSyncStore.getState().setConnectivity("unknown");
      return;
    }

    let disposed = false;
    let lastInternetAvailable: boolean | null = null;
    let validatingOfflineSession = false;

    async function checkConnectivityAndSync(
      source: "startup" | "network" | "foreground",
    ) {
      logSyncTrigger("connectivity-check-start", {
        source,
        sessionMode: sessionMode,
      });
      try {
        /**
         * Read current state instead of trusting a possibly stale
         * reachability event after the app resumes.
         */
        const networkState = await Network.getNetworkStateAsync();

        if (disposed) {
          return;
        }

        const internetAvailable =
          networkState.isConnected !== false &&
          networkState.isInternetReachable !== false;

        const previousInternetAvailable = lastInternetAvailable;
        lastInternetAvailable = internetAvailable;

        useSyncStore
          .getState()
          .setConnectivity(internetAvailable ? "online" : "offline");

        // Ignore duplicate network events and the first network event.
        // Startup and foreground checks retain their existing behavior.
        if (
          source === "network" &&
          (previousInternetAvailable === null ||
            previousInternetAvailable === internetAvailable)
        ) {
          return;
        }

        if (!internetAvailable) {
          return;
        }

        const authState = useAuthStore.getState();

        if (!authState.isAuthenticated || !authState.user) {
          return;
        }

        /**
         * An offline-restored session is not automatically trusted
         * as an online session just because Wi-Fi returned.
         * Revalidate it with the existing auth initialization flow.
         */
        if (authState.sessionMode === "offline") {
          if (validatingOfflineSession) {
            return;
          }

          validatingOfflineSession = true;

          try {
            await authState.initializeAuth();
          } catch (error) {
            console.warn("Could not restore the online session:", error);
          } finally {
            validatingOfflineSession = false;
          }

          return;
        }

        if (authState.sessionMode === "online") {
          void syncNow().catch((error) => {
            console.warn("Automatic synchronization failed:", error);
          });
        }
      } catch (error) {
        if (!disposed) {
          useSyncStore.getState().setConnectivity("unknown");
        }

        console.warn("Could not determine network state:", error);
      }
    }

    // Startup / authenticated-session trigger.
    void checkConnectivityAndSync("startup");

    // Treat network events as a signal to recheck the current state.
    const networkSubscription = Network.addNetworkStateListener(() => {
      void checkConnectivityAndSync("network");
    });

    // Retry when the user returns to the foreground.
    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextState) => {
        if (nextState === "active") {
          void checkConnectivityAndSync("foreground");
        }
      },
    );

    return () => {
      disposed = true;
      networkSubscription.remove();
      appStateSubscription.remove();
    };
  }, [isAuthenticated, sessionMode, initializeAuth]);

  if (isLoading) {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <Stack>
        <Stack.Screen
          name="login"
          options={{ title: "Sign In", headerShown: false }}
        />
        <Stack.Screen
          name="register"
          options={{ title: "Create Account", headerShown: false }}
        />
        <Stack.Screen
          name="index"
          options={{
            title: "Jobs",
            headerShown: true,
          }}
        />
        <Stack.Screen
          name="jobs/create"
          options={{
            title: "Create Job",
            headerShown: true,
          }}
        />
        <Stack.Screen
          name="jobs/[id]"
          options={{
            title: "Job Details",
            headerShown: true,
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
});
