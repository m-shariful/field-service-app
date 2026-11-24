import { JobModel } from "../models/job";

// backfill missing job versions
export async function backfillJobVersions(): Promise<void> {
  const result = await JobModel.updateMany(
    {
      version: {
        $exists: false,
      },
    },
    {
      $set: {
        version: 1,
      },
    },
  );

  console.info("Job version migration completed", {
    matched: result.matchedCount,
    modified: result.modifiedCount,
  });
}
