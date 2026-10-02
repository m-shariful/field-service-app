import {
  googleAuthController,
  loginController,
  logoutController,
  meController,
  refreshController,
  registerController,
} from "../controllers/auth.controller";

import { Router } from "express";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.post("/register", registerController);

router.post("/login", loginController);

router.post("/google", googleAuthController);

router.post("/refresh", refreshController);

router.post("/logout", logoutController);

router.get("/me", requireAuth, meController);

export default router;
