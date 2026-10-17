import {
  createJobController,
  getJob,
  listJobs,
  syncJobs,
  updateJobStatusController,
} from "../controllers/job.controller";

import { Router } from "express";
import { requireAuth } from "../middleware/auth";

const router = Router();

// every job operation requires an authenticated user.
router.use(requireAuth);

router.get("/", listJobs);

// sync jobs endpoint is used by the Sync Engine to pull changes from the server.
router.get("/sync", syncJobs);

router.post("/", createJobController);
router.get("/:id", getJob);
router.patch("/:id/status", updateJobStatusController);

export default router;
