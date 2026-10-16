import express from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import {
  getTasks,
  getTask,
  createTaskHandler,
  updateTaskHandler,
  deleteTaskHandler
} from "../controllers/taskController.js";

const router = express.Router();

router.use(authenticate);

router.get("/", getTasks);
router.get("/:id", getTask);
router.post("/", createTaskHandler);
router.patch("/:id", updateTaskHandler);
router.delete("/:id", deleteTaskHandler);

export default router;