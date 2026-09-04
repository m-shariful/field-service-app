import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme";
import type { Job } from "./types";

const PRIORITY_CONFIG: Record<
  Job["priority"],
  {
    label: string;
    backgroundColor: string;
    textColor: string;
  }
> = {
  low: {
    label: "Low",
    backgroundColor: colors.neutral[100],
    textColor: colors.neutral[500],
  },

  medium: {
    label: "Medium",
    backgroundColor: colors.neutral[100],
    textColor: colors.neutral[700],
  },

  high: {
    label: "High",
    backgroundColor: colors.warning[50],
    textColor: colors.warning[700],
  },

  urgent: {
    label: "Urgent",
    backgroundColor: colors.danger[50],
    textColor: colors.danger[700],
  },
};

interface PriorityBadgeProps {
  priority: Job["priority"];
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.backgroundColor,
        },
      ]}
    >
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
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },

  text: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
});
