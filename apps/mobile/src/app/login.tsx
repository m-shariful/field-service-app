import {
  ActivityIndicator,
  Alert,
  Button,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { login, loginWithGoogle } from "@/api/auth";

import { ApiError } from "@/api/api-error";
import { Link } from "expo-router";
import { colors } from "@/theme/colors";
import { signInWithGoogle } from "@/services/google-auth";
import { spacing } from "@/theme/spacing";
import { useAuthStore } from "@/stores/auth.store";
import { useState } from "react";

export default function LoginScreen() {
  const setSession = useAuthStore((state) => state.setSession);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  async function handleEmailLogin() {
    if (!email.trim() || !password) {
      Alert.alert("Invalid input", "Please enter your email and password.");

      return;
    }

    try {
      setIsSubmitting(true);

      const result = await login({
        email: email.trim(),
        password,
      });

      await setSession(result);
    } catch (error) {
      if (error instanceof ApiError) {
        Alert.alert("Sign in failed", error.message);
      } else {
        Alert.alert("Sign in failed", "Unable to sign in. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleLogin() {
    try {
      setIsGoogleSubmitting(true);

      const googleResult = await signInWithGoogle();

      if (!googleResult.idToken) {
        throw new Error("Google ID token was not returned.");
      }

      const result = await loginWithGoogle(googleResult.idToken);

      await setSession(result);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "GOOGLE_SIGN_IN_CANCELLED"
      ) {
        return;
      }

      if (error instanceof ApiError) {
        Alert.alert("Google sign in failed", error.message);

        return;
      }

      Alert.alert(
        "Google sign in failed",
        "Unable to sign in with Google. Please try again.",
      );
    } finally {
      setIsGoogleSubmitting(false);
    }
  }

  const isSubmittingAny = isSubmitting || isGoogleSubmitting;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome back</Text>

        <Text style={styles.subtitle}>Sign in to continue to your jobs.</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.text.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!isSubmittingAny}
            style={styles.input}
          />

          <Text style={styles.label}>Password</Text>

          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            placeholderTextColor={colors.text.muted}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isSubmittingAny}
            style={styles.input}
          />

          {isSubmitting ? (
            <ActivityIndicator
              size="small"
              color={colors.primary}
              style={styles.loader}
            />
          ) : (
            <Button
              title="Sign In"
              onPress={handleEmailLogin}
              disabled={isSubmittingAny}
            />
          )}

          <View style={styles.divider}>
            <View style={styles.dividerLine} />

            <Text style={styles.dividerText}>OR</Text>

            <View style={styles.dividerLine} />
          </View>

          {isGoogleSubmitting ? (
            <ActivityIndicator
              size="small"
              color={colors.primary}
              style={styles.loader}
            />
          ) : (
            <Button
              title="Continue with Google"
              onPress={handleGoogleLogin}
              disabled={isSubmittingAny}
            />
          )}

          <Text style={styles.switchText}>Don't have an account?</Text>

          <Link href="/register" asChild>
            <Pressable
              disabled={isSubmittingAny}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Create Account</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },

  title: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.text.primary,
  },

  subtitle: {
    marginTop: spacing.sm,
    fontSize: 15,
    color: colors.text.secondary,
  },

  form: {
    marginTop: spacing.xxl,
  },

  label: {
    marginBottom: spacing.xs,
    fontSize: 13,
    fontWeight: "600",
    color: colors.text.primary,
  },

  input: {
    minHeight: 48,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    color: colors.text.primary,
  },

  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginVertical: spacing.lg,
  },

  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },

  dividerText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text.muted,
  },

  loader: {
    minHeight: 40,
  },

  switchText: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    textAlign: "center",
    fontSize: 13,
    color: colors.text.secondary,
  },

  secondaryButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    width: "100%",
  },

  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text.primary,
    textAlign: "center",
  },

  buttonPressed: {
    opacity: 0.7,
  },
});
