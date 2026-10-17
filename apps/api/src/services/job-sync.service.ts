import { Job, JobModel } from "../models/job";

import {
  decodeJobSyncCursor,
  encodeJobSyncCursor,
  type JobSyncCursor,
} from "../utils/sync-cursor";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

interface JobWithTimestamps extends Job {
  createdAt: Date;
  updatedAt: Date;
}

export interface JobSyncItem extends Job {
  createdAt: string;
  updatedAt: string;
}

export interface JobSyncResult {
  items: JobSyncItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

function serializeJob(job: JobWithTimestamps): JobSyncItem {
  return {
    id: job.id,
    userId: job.userId,

    title: job.title,
    scheduledAt: job.scheduledAt,
    location: job.location,

    status: job.status,
    priority: job.priority,

    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

function buildNextCursor(job: JobWithTimestamps | undefined): string | null {
  if (!job) {
    return null;
  }
  return encodeJobSyncCursor({
    updatedAt: job.updatedAt.toISOString(),
    id: job.id,
  });
}

export async function pullJobChanges(
  userId: string,
  options: {
    cursor?: string;
    limit?: number;
  } = {},
): Promise<JobSyncResult> {
  const requestedLimit = options.limit ?? DEFAULT_LIMIT;

  const limit = Math.min(Math.max(requestedLimit, 1), MAX_LIMIT);

  let cursor: JobSyncCursor | null = null;

  if (options.cursor) {
    cursor = decodeJobSyncCursor(options.cursor);
  }

  const filter: Record<string, unknown> = {
    userId,
  };

  if (cursor) {
    const cursorDate = new Date(cursor.updatedAt);

    /**
     * Deterministic cursor ordering:
     *
     * updatedAt ASC
     * then id ASC
     *
     * We only return values strictly after the
     * current cursor.
     */
    filter.$or = [
      {
        updatedAt: {
          $gt: cursorDate,
        },
      },
      {
        updatedAt: cursorDate,
        id: {
          $gt: cursor.id,
        },
      },
    ];
  }

  /**
   * Fetch one extra record.
   *
   * This lets us determine hasMore without
   * doing a second COUNT query.
   */
  const jobs = await JobModel.find(filter)
    .sort({
      updatedAt: 1,
      id: 1,
    })
    .limit(limit + 1)
    .lean<JobWithTimestamps[]>();

  const hasMore = jobs.length > limit;

  const page = hasMore ? jobs.slice(0, limit) : jobs;

  const items = page.map(serializeJob);

  let nextCursor: string | null = options.cursor ?? null;

  if (page.length > 0) {
    nextCursor = buildNextCursor(page[page.length - 1]);
  }

  return {
    items,
    nextCursor,
    hasMore,
  };
}
