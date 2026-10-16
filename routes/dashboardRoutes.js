import express from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import { getDashboard } from "../controllers/dashboardController.js";

const router = express.Router();

router.use(authenticate);
router.get("/", getDashboard);

export default router;