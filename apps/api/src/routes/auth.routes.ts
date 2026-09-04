import {
  loginController,
  meController,
  registerController,
} from "../controllers/auth.controller";

import { Router } from "express";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.post("/register", registerController);
router.post("/login", loginController);
router.get("/me", requireAuth, meController);

export default router;
