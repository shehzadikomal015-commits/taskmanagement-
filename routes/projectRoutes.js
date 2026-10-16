import express from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import {
  getProjects,
  getProject,
  createProjectHandler,
  updateProjectHandler,
  deleteProjectHandler
} from "../controllers/projectController.js";

const router = express.Router();

router.use(authenticate);

router.get("/", getProjects);
router.get("/:id", getProject);
router.post("/", createProjectHandler);
router.patch("/:id", updateProjectHandler);
router.delete("/:id", deleteProjectHandler);

export default router;