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
  /**
   * Setting an already-applied state is idempotent.
   *
   * This is not considered a state transition, so it is safe
   * for the Sync Engine to retry the same mutation.
   */
  if (currentStatus === nextStatus) {
    return nextStatus;
  }

  if (!canTransitionJobStatus(currentStatus, nextStatus)) {
    throw new Error(
      `Cannot transition job from ${currentStatus} to ${nextStatus}`,
    );
  }

  return nextStatus;
}
