import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";

import { apiPost } from "@/api/client";
import Constants from "expo-constants";
import { Platform } from "react-native";

const DEVICE_TOKEN_PATH = "/api/notifications/devices";
const STORED_PUSH_TOKEN_KEY = "field_service_expo_push_token";

interface ApiSuccessResponse<T> {
  data: T;
}

interface RegisteredDevice {
  id: string;
  token: string;
  platform: "ios" | "android";
  enabled: boolean;
}

export type PushRegistrationResult =
  | { status: "registered" }
  | { status: "permission-denied" }
  | { status: "unsupported" };

function getProjectId(): string {
  const projectId =
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId;

  if (!projectId) {
    throw new Error("EAS_PROJECT_ID_NOT_CONFIGURED");
  }

  return projectId;
}

export async function getPushRegistrationState(): Promise<boolean> {
  if (Platform.OS !== "android" && Platform.OS !== "ios") {
    return false;
  }

  const [storedToken, permissions] = await Promise.all([
    SecureStore.getItemAsync(STORED_PUSH_TOKEN_KEY),
    Notifications.getPermissionsAsync(),
  ]);

  return Boolean(storedToken && permissions.granted);
}

export async function registerPushNotifications(): Promise<PushRegistrationResult> {
  if (
    (Platform.OS !== "android" && Platform.OS !== "ios") ||
    !Device.isDevice
  ) {
    return { status: "unsupported" };
  }

  // Android requires a notification channel before notifications are posted.
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "General notifications",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#2563EB",
    });
  }

  let permissions = await Notifications.getPermissionsAsync();

  // Ask only when permission has not been decided before.
  // If the user previously denied it, direct them to system settings
  // rather than repeatedly showing a permission request.
  if (!permissions.granted) {
    if (permissions.status !== "undetermined") {
      return { status: "permission-denied" };
    }

    permissions = await Notifications.requestPermissionsAsync();
  }

  if (!permissions.granted) {
    return { status: "permission-denied" };
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync({
    projectId: getProjectId(),
  });

  const token = tokenResponse.data;
  const platform = Platform.OS as "ios" | "android";

  // Register against the currently authenticated account.
  // The backend upserts by token, so repeating this request is safe.
  await apiPost<ApiSuccessResponse<RegisteredDevice>>(DEVICE_TOKEN_PATH, {
    token,
    platform,
  });

  // Save only after the server has accepted the registration.
  await SecureStore.setItemAsync(STORED_PUSH_TOKEN_KEY, token);

  return { status: "registered" };
}
