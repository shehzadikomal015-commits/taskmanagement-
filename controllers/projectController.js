import {
  createProject,
  getProjectsByUser,
  getProjectById,
  updateProject,
  deleteProject
} from "../models/projectModel.js";

export const getProjects = async (req, res, next) => {
  try {
    const projects = await getProjectsByUser(req.user.id);

    res.status(200).json({ projects });
  } catch (error) {
    next(error);
  }
};

export const getProject = async (req, res, next) => {
  try {
    const project = await getProjectById(
      req.params.id,
      req.user.id
    );

    if (!project) {
      return res.status(404).json({
        message: "Project not found"
      });
    }

    res.status(200).json({ project });
  } catch (error) {
    next(error);
  }
};

export const createProjectHandler = async (req, res, next) => {
  try {
    const { name, description } = req.body;

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        message: "Project name is required"
      });
    }

    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      return res.status(400).json({
        message: "Description must be a string or null"
      });
    }

    const project = await createProject(
      req.user.id,
      name.trim(),
      description
    );

    res.status(201).json({
      message: "Project created successfully",
      project
    });
  } catch (error) {
    next(error);
  }
};

export const updateProjectHandler = async (req, res, next) => {
  try {
    const { name, description } = req.body;

    if (name === undefined && description === undefined) {
      return res.status(400).json({
        message: "Provide a name or description to update"
      });
    }

    if (
      name !== undefined &&
      (typeof name !== "string" || !name.trim())
    ) {
      return res.status(400).json({
        message: "Name must be a non-empty string"
      });
    }

    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      return res.status(400).json({
        message: "Description must be a string or null"
      });
    }

    const project = await updateProject(
      req.params.id,
      req.user.id,
      name === undefined ? null : name.trim(),
      description
    );

    if (!project) {
      return res.status(404).json({
        message: "Project not found"
      });
    }

    res.status(200).json({
      message: "Project updated successfully",
      project
    });
  } catch (error) {
    next(error);
  }
};

export const deleteProjectHandler = async (req, res, next) => {
  try {
    const project = await deleteProject(
      req.params.id,
      req.user.id
    );

    if (!project) {
      return res.status(404).json({
        message: "Project not found"
      });
    }

    res.status(200).json({
      message: "Project deleted successfully",
      project
    });
  } catch (error) {
    next(error);
  }
};