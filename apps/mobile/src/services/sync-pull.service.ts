import { apiGet } from "@/api/client";
import { getDatabase } from "@/db/database";

import type { Job } from "@/features/jobs/types";

import {
  applyServerJobFromPull,
  type ServerJob,
} from "@/repositories/local-jobs.repository";

import {
  getSyncState,
  saveSyncCursor,
} from "@/repositories/sync-state.repository";

import { useAuthStore } from "@/stores/auth.store";

interface JobSyncResponse {
  data: {
    items: Job[];

    nextCursor: string | null;

    hasMore: boolean;
  };
}

const PAGE_SIZE = 50;

const MAX_PAGES_PER_RUN = 20;

function getCurrentUserId(): string | null {
  return useAuthStore.getState().user?.id ?? null;
}

export interface PullSyncResult {
  pages: number;
  jobsApplied: number;

  cursor: string | null;

  hasMore: boolean;
}

export async function pullJobChanges(): Promise<PullSyncResult> {
  const authState = useAuthStore.getState();

  if (
    !authState.user ||
    !authState.isAuthenticated ||
    authState.sessionMode !== "online"
  ) {
    return {
      pages: 0,
      jobsApplied: 0,
      cursor: null,
      hasMore: false,
    };
  }

  const userId = getCurrentUserId();

  if (!userId) {
    return {
      pages: 0,
      jobsApplied: 0,
      cursor: null,
      hasMore: false,
    };
  }

  const db = await getDatabase();

  const syncState = await getSyncState(db, userId, "job");

  let cursor = syncState?.cursor ?? null;

  let pages = 0;
  let jobsApplied = 0;

  let hasMore = true;

  while (hasMore && pages < MAX_PAGES_PER_RUN) {
    const query = new URLSearchParams();

    query.set("limit", String(PAGE_SIZE));

    if (cursor) {
      query.set("cursor", cursor);
    }

    const response = await apiGet<JobSyncResponse>(
      `/api/jobs/sync?${query.toString()}`,
    );

    const page = response.data;

    /**
     * IMPORTANT:
     *
     * Apply jobs + save cursor in ONE SQLite
     * transaction.
     *
     * If the process crashes halfway through:
     *
     * transaction rolls back
     * cursor does not advance
     *
     * so the same server changes are fetched again.
     *
     * Re-applying the same server snapshot is safe.
     */
    await db.withTransactionAsync(async () => {
      for (const job of page.items) {
        await applyServerJobFromPull(db, userId, job as ServerJob);

        jobsApplied += 1;
      }

      await saveSyncCursor(db, userId, "job", page.nextCursor);
    });

    cursor = page.nextCursor;

    hasMore = page.hasMore;

    pages += 1;

    if (!page.hasMore) {
      break;
    }
  }

  return {
    pages,
    jobsApplied,
    cursor,
    hasMore,
  };
}
