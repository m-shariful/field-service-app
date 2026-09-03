import {
  createJobController,
  getJob,
  listJobs,
  updateJobStatusController,
} from "../controllers/job.controller";

import { Router } from "express";

const router = Router();

router.get("/", listJobs);
router.post("/", createJobController);
router.get("/:id", getJob);
router.patch("/:id/status", updateJobStatusController);

export default router;
