import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme";
import type { Job } from "./types";

const STATUS_CONFIG: Record<
  Job["status"],
  {
    label: string;
    backgroundColor: string;
    textColor: string;
    dotColor: string;
  }
> = {
  scheduled: {
    label: "Scheduled",
    backgroundColor: colors.primary[50],
    textColor: colors.primary[600],
    dotColor: colors.primary[500],
  },

  in_progress: {
    label: "In Progress",
    backgroundColor: colors.warning[50],
    textColor: colors.warning[700],
    dotColor: colors.warning[500],
  },

  completed: {
    label: "Completed",
    backgroundColor: colors.success[50],
    textColor: colors.success[700],
    dotColor: colors.success[500],
  },
};

interface StatusBadgeProps {
  status: Job["status"];
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.backgroundColor,
        },
      ]}
    >
      <View
        style={[
          styles.dot,
          {
            backgroundColor: config.dotColor,
          },
        ]}
      />

      <Text
        style={[
          styles.text,
          {
            color: config.textColor,
          },
        ]}
      >
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },

  text: {
    fontSize: 13,
    fontWeight: "600",
  },
});
