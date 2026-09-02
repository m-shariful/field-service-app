import { StyleSheet, View } from "react-native";

export function JobCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.titleContainer}>
          <View style={[styles.placeholder, styles.title]} />
          <View style={[styles.placeholder, styles.jobId]} />
        </View>

        <View style={[styles.placeholder, styles.priority]} />
      </View>

      <View style={styles.divider} />

      <View style={styles.infoRow}>
        <View style={[styles.placeholder, styles.icon]} />

        <View style={styles.infoContent}>
          <View style={[styles.placeholder, styles.label]} />
          <View style={[styles.placeholder, styles.value]} />
        </View>
      </View>

      <View style={styles.infoRow}>
        <View style={[styles.placeholder, styles.icon]} />

        <View style={styles.infoContent}>
          <View style={[styles.placeholder, styles.label]} />
          <View style={[styles.placeholder, styles.location]} />
        </View>
      </View>

      <View style={styles.footer}>
        <View style={[styles.placeholder, styles.status]} />
        <View style={[styles.placeholder, styles.viewDetails]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 14,
    padding: 18,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",

    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,

    elevation: 2,
  },

  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },

  titleContainer: {
    flex: 1,
  },

  placeholder: {
    backgroundColor: "#E2E8F0",
    borderRadius: 6,
  },

  title: {
    width: "75%",
    height: 18,
  },

  jobId: {
    width: 70,
    height: 10,
    marginTop: 8,
  },

  priority: {
    width: 58,
    height: 24,
    borderRadius: 999,
  },

  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 16,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  icon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginRight: 10,
  },

  infoContent: {
    flex: 1,
  },

  label: {
    width: 65,
    height: 9,
  },

  value: {
    width: 150,
    height: 13,
    marginTop: 6,
  },

  location: {
    width: "60%",
    height: 13,
    marginTop: 6,
  },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },

  status: {
    width: 90,
    height: 26,
    borderRadius: 999,
  },

  viewDetails: {
    width: 85,
    height: 12,
  },
});
