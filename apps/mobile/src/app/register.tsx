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

import { ApiError } from "@/api/api-error";
import { Link } from "expo-router";
import { colors } from "@/theme/colors";
import { register } from "@/api/auth";
import { spacing } from "@/theme/spacing";
import { useAuthStore } from "@/stores/auth.store";
import { useState } from "react";

export default function RegisterScreen() {
  const setSession = useAuthStore((state) => state.setSession);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRegister() {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || !trimmedEmail || !password) {
      Alert.alert("Invalid input", "Please complete all required fields.");

      return;
    }

    if (password.length < 8) {
      Alert.alert(
        "Invalid password",
        "Password must be at least 8 characters.",
      );

      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(
        "Passwords do not match",
        "Please make sure both passwords are the same.",
      );

      return;
    }

    try {
      setIsSubmitting(true);

      const result = await register({
        name: trimmedName,
        email: trimmedEmail,
        password,
      });

      await setSession(result);
    } catch (error) {
      if (error instanceof ApiError) {
        Alert.alert("Registration failed", error.message);

        return;
      }

      Alert.alert(
        "Registration failed",
        "Unable to create your account. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Create account</Text>

        <Text style={styles.subtitle}>
          Create an account to manage your field jobs.
        </Text>

        <View style={styles.form}>
          <Text style={styles.label}>Name</Text>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={colors.text.muted}
            autoCapitalize="words"
            autoCorrect={false}
            editable={!isSubmitting}
            style={styles.input}
          />

          <Text style={styles.label}>Email</Text>

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.text.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!isSubmitting}
            style={styles.input}
          />

          <Text style={styles.label}>Password</Text>

          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            placeholderTextColor={colors.text.muted}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isSubmitting}
            style={styles.input}
          />

          <Text style={styles.label}>Confirm password</Text>

          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Re-enter your password"
            placeholderTextColor={colors.text.muted}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isSubmitting}
            style={styles.input}
          />

          {isSubmitting ? (
            <ActivityIndicator
              size="small"
              color={colors.primary[500]}
              style={styles.loader}
            />
          ) : (
            <Button
              title="Create Account"
              onPress={handleRegister}
              disabled={isSubmitting}
            />
          )}

          <Text style={styles.switchText}>Already have an account?</Text>

          <Link href="/login" asChild>
            <Pressable
              disabled={isSubmitting}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Sign In</Text>
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
    lineHeight: 22,
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

  primaryButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.primary[500],
  },

  primaryButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text.inverse,
  },

  secondaryButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    textAlign: "center",
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

  switchText: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    textAlign: "center",
    fontSize: 13,
    color: colors.text.secondary,
  },

  loader: {
    minHeight: 48,
  },
});
