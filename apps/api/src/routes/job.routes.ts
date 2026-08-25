import { getJob, listJobs } from "../controllers/job.controller";

import { Router } from "express";

const router = Router();

router.get("/", listJobs);
router.get("/:id", getJob);

export default router;
