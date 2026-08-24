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
