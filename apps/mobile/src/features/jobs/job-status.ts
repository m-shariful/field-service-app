import type { JobStatus } from "./types";

export function canStartJob(status: JobStatus): boolean {
  return status === "scheduled";
}

export function canCompleteJob(status: JobStatus): boolean {
  return status === "in_progress";
}

export function startJob(status: JobStatus): JobStatus {
  if (!canStartJob(status)) {
    throw new Error(`Cannot start job from status: ${status}`);
  }

  return "in_progress";
}

export function completeJob(status: JobStatus): JobStatus {
  if (!canCompleteJob(status)) {
    throw new Error(`Cannot complete job from status: ${status}`);
  }

  return "completed";
}

// Learning: Keep the UI's "what action comes next?" logic
// in one place instead of duplicating status checks in screens.
export function getNextJobStatus(status: JobStatus): JobStatus | null {
  if (canStartJob(status)) {
    return "in_progress";
  }

  if (canCompleteJob(status)) {
    return "completed";
  }

  return null;
}

export function getJobActionLabel(status: JobStatus): string | null {
  if (canStartJob(status)) {
    return "Start Job";
  }

  if (canCompleteJob(status)) {
    return "Complete Job";
  }

  return null;
}
