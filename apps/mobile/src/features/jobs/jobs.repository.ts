import { apiGet, apiPatch } from "@/api/client";

import type { Job } from "./types";

interface JobsResponse {
  data: Job[];
}

interface JobResponse {
  data: Job;
}

export async function getJobs(): Promise<Job[]> {
  const response = await apiGet<JobsResponse>("/api/jobs");

  return response.data;
}

export async function getJobById(id: string): Promise<Job> {
  const response = await apiGet<JobResponse>(`/api/jobs/${id}`);

  return response.data;
}

export async function updateJobStatus(
  id: string,
  status: Job["status"],
): Promise<Job> {
  const response = await apiPatch<JobResponse>(`/api/jobs/${id}/status`, {
    status,
  });

  return response.data;
}
