import express from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import {
  getMe,
  updateMe,
  deleteMe
} from "../controllers/authController.js";

const router = express.Router();

router.use(authenticate);

router.get("/me", getMe);
router.patch("/me", updateMe);
router.delete("/me", deleteMe);

export default router;