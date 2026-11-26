import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  getPushRegistrationState,
  registerPushNotifications,
} from "./push-notifications.service";

type SetupStatus =
  | "loading"
  | "idle"
  | "registered"
  | "denied"
  | "unsupported"
  | "error";

export function PushNotificationSetup() {
  const [status, setStatus] = useState<SetupStatus>("loading");

  useEffect(() => {
    let mounted = true;

    void getPushRegistrationState()
      .then((isRegistered) => {
        if (mounted) {
          setStatus(isRegistered ? "registered" : "idle");
        }
      })
      .catch(() => {
        if (mounted) {
          setStatus("idle");
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleEnable = async () => {
    try {
      setStatus("loading");

      const result = await registerPushNotifications();

      switch (result.status) {
        case "registered":
          setStatus("registered");
          break;
        case "permission-denied":
          setStatus("denied");
          break;
        case "unsupported":
          setStatus("unsupported");
          break;
      }
    } catch (error) {
      console.warn("Push notification registration failed:", error);
      setStatus("error");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Push notifications</Text>

        <Text style={styles.description}>
          Receive job updates and reminders even when the app is not open.
        </Text>

        {status === "registered" ? (
          <Text style={styles.successText}>
            Push notifications are enabled on this device.
          </Text>
        ) : status === "loading" ? (
          <View style={styles.loading}>
            <ActivityIndicator size="small" />
            <Text style={styles.statusText}>
              Checking notification status...
            </Text>
          </View>
        ) : (
          <>
            <Pressable
              onPress={() => void handleEnable()}
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.buttonText}>Enable push notifications</Text>
            </Pressable>

            {status === "denied" && (
              <Text style={styles.statusText}>
                Permission was denied. Enable notifications from your device
                settings.
              </Text>
            )}

            {status === "unsupported" && (
              <Text style={styles.statusText}>
                Push notifications require a supported physical device.
              </Text>
            )}

            {status === "error" && (
              <Text style={styles.errorText}>
                Registration failed. Check your connection and try again.
              </Text>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 18,
    marginBottom: 8,
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#EFF6FF",
  },
  content: {
    gap: 9,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E3A8A",
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
    color: "#475569",
  },
  button: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 9,
    backgroundColor: "#2563EB",
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  loading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  statusText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#475569",
  },
  successText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#166534",
  },
  errorText: {
    fontSize: 12,
    color: "#B91C1C",
  },
});
