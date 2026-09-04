import {
  createJobController,
  getJob,
  listJobs,
  updateJobStatusController,
} from "../controllers/job.controller";

import { Router } from "express";
import { requireAuth } from "../middleware/auth";

const router = Router();

// every job operation requires an authenticated user.
router.use(requireAuth);

router.get("/", listJobs);
router.post("/", createJobController);
router.get("/:id", getJob);
router.patch("/:id/status", updateJobStatusController);

export default router;
