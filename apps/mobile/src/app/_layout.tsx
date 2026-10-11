import { Stack, router, usePathname } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { syncPendingMutations } from "@/services/sync-engine";
import { useAuthStore } from "@/stores/auth.store";
import { colors } from "@/theme";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

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
  useEffect(() => {
    if (!isAuthenticated || sessionMode !== "online") {
      return;
    }

    void syncPendingMutations().catch((error) => {
      console.warn("Background sync failed:", error);
    });
  }, [isAuthenticated, sessionMode]);

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
