import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack>
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
      </Stack>
    </SafeAreaProvider>
  );
}
