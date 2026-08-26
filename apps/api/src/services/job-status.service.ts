import { JobStatus } from "../models/job";

export function canTransitionJobStatus(
  currentStatus: JobStatus,
  nextStatus: JobStatus,
): boolean {
  return (
    (currentStatus === "scheduled" && nextStatus === "in_progress") ||
    (currentStatus === "in_progress" && nextStatus === "completed")
  );
}

export function transitionJobStatus(
  currentStatus: JobStatus,
  nextStatus: JobStatus,
): JobStatus {
  if (!canTransitionJobStatus(currentStatus, nextStatus)) {
    throw new Error(
      `Cannot transition job from ${currentStatus} to ${nextStatus}`,
    );
  }

  return nextStatus;
}
