import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { createJob } from "@/features/jobs/jobs.repository";
import type { JobPriority } from "@/features/jobs/types";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { router } from "expo-router";
import { useState } from "react";

const PRIORITIES: { label: string; value: JobPriority }[] = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Urgent", value: "urgent" },
];

type PickerMode = "date" | "time" | null;

function formatScheduledDateTime(date: Date | null) {
  if (!date) {
    return "Select date & time";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function CreateJobScreen() {
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");

  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);

  // Learning: One state controls which native picker is currently visible.
  // null means that no picker is open.
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);

  const [priority, setPriority] = useState<JobPriority>("medium");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    // Learning: "dismissed" means the user pressed Cancel.
    // Closing the picker is the only action we take in that case.
    if (event.type === "dismissed" || !selectedDate) {
      setPickerMode(null);
      return;
    }

    setScheduledAt((current) => {
      const next = current ? new Date(current) : new Date();

      next.setFullYear(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
      );

      return next;
    });

    // After selecting a date, move directly to time selection.
    setPickerMode("time");
  };

  const handleTimeChange = (
    event: DateTimePickerEvent,
    selectedTime?: Date,
  ) => {
    // Always close the picker after the time interaction finishes.
    setPickerMode(null);

    if (event.type === "dismissed" || !selectedTime) {
      return;
    }

    setScheduledAt((current) => {
      const next = current ? new Date(current) : new Date();

      next.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);

      return next;
    });
  };

  const handleSubmit = async () => {
    setError(null);

    const trimmedTitle = title.trim();
    const trimmedLocation = location.trim();

    if (!trimmedTitle) {
      setError("Please enter a job title.");
      return;
    }

    if (!trimmedLocation) {
      setError("Please enter a location.");
      return;
    }

    if (!scheduledAt) {
      setError("Please select a scheduled date and time.");
      return;
    }

    try {
      setIsSubmitting(true);

      await createJob({
        title: trimmedTitle,
        location: trimmedLocation,
        scheduledAt: scheduledAt.toISOString(),
        priority,
      });

      router.back();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to create job. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Create Job</Text>

        <Text style={styles.subtitle}>
          Add the details for a new field service job.
        </Text>

        <View style={styles.form}>
          <FormField
            label="Job title"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. AC Unit Inspection"
          />

          <FormField
            label="Location"
            value={location}
            onChangeText={setLocation}
            placeholder="e.g. Rajshahi City"
          />

          <View style={styles.field}>
            <Text style={styles.label}>Scheduled Date & Time</Text>

            <Pressable
              onPress={() => setPickerMode("date")}
              style={({ pressed }) => [
                styles.input,
                styles.dateTimeInput,
                pressed && styles.inputPressed,
              ]}
            >
              <Text
                style={[styles.inputText, !scheduledAt && styles.placeholder]}
              >
                {formatScheduledDateTime(scheduledAt)}
              </Text>
            </Pressable>
          </View>

          {pickerMode === "date" && (
            <DateTimePicker
              key="date-picker"
              value={scheduledAt ?? new Date()}
              mode="date"
              display="default"
              minimumDate={new Date()}
              onChange={handleDateChange}
            />
          )}

          {pickerMode === "time" && (
            <DateTimePicker
              key="time-picker"
              value={scheduledAt ?? new Date()}
              mode="time"
              display="default"
              onChange={handleTimeChange}
            />
          )}

          <View>
            <Text style={styles.label}>Priority</Text>

            <View style={styles.priorityRow}>
              {PRIORITIES.map((item) => {
                const selected = priority === item.value;

                return (
                  <Pressable
                    key={item.value}
                    onPress={() => setPriority(item.value)}
                    style={({ pressed }) => [
                      styles.priorityButton,
                      selected && styles.priorityButtonSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.priorityText,
                        selected && styles.priorityTextSelected,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Pressable
            onPress={handleSubmit}
            disabled={isSubmitting}
            style={({ pressed }) => [
              styles.createButton,
              pressed && styles.createButtonPressed,
              isSubmitting && styles.createButtonDisabled,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.text.inverse} />
            ) : (
              <Text style={styles.createButtonText}>Create Job</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

interface FormFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  autoCapitalize?: "none" | "sentences";
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  autoCapitalize = "sentences",
}: FormFieldProps) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.text.muted}
        autoCapitalize={autoCapitalize}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
  },

  title: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.text.primary,
  },

  subtitle: {
    marginTop: spacing.xs,
    marginBottom: spacing.xxl,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text.secondary,
  },

  form: {
    gap: spacing.xl,
  },

  field: {
    marginBottom: spacing.lg,
  },

  label: {
    marginBottom: spacing.sm,
    fontSize: 13,
    fontWeight: "700",
    color: colors.text.primary,
  },

  input: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    fontSize: 15,
    color: colors.text.primary,
  },

  dateTimeInput: {
    justifyContent: "center",
  },

  inputText: {
    fontSize: 15,
    color: colors.text.primary,
  },

  placeholder: {
    color: colors.text.muted,
  },

  inputPressed: {
    opacity: 0.7,
  },

  priorityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },

  priorityButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },

  priorityButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: "#EFF6FF",
  },

  priorityText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text.secondary,
  },

  priorityTextSelected: {
    color: colors.primary,
  },

  pressed: {
    opacity: 0.7,
  },

  createButton: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: colors.primary,
  },

  createButtonPressed: {
    opacity: 0.8,
  },

  createButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text.inverse,
  },

  errorText: {
    marginTop: -4,
    fontSize: 13,
    lineHeight: 19,
    color: "#DC2626",
  },

  createButtonDisabled: {
    opacity: 0.6,
  },
});
