import { Router } from "express";
import {
  googleAuthController,
  loginController,
  meController,
  registerController,
} from "../controllers/auth.controller";

import { requireAuth } from "../middleware/auth";

const router = Router();

router.post("/register", registerController);
router.post("/login", loginController);
router.post("/google", googleAuthController);
router.get("/me", requireAuth, meController);

export default router;
