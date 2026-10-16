import pool from "../db.js";
import {
  createTask,
  getTasksByUser,
  getTaskById,
  updateTask,
  deleteTask
} from "../models/taskModel.js";

const validStatuses = ["pending", "in_progress", "completed"];

const validDate = (value) => {
  if (typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
};

export const getTasks = async (req, res, next) => {
  try {
    const {
      search,
      status,
      project_id,
      overdue,
      page = "1",
      limit = "10",
      sortBy = "created_at",
      order = "DESC"
    } = req.query;

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid status"
      });
    }

    if (
      project_id !== undefined &&
      (!/^\d+$/.test(project_id) || Number(project_id) < 1)
    ) {
      return res.status(400).json({
        message: "project_id must be a positive integer"
      });
    }

    if (
      overdue !== undefined &&
      overdue !== "true" &&
      overdue !== "false"
    ) {
      return res.status(400).json({
        message: "overdue must be true or false"
      });
    }

    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    if (
      !Number.isInteger(pageNumber) ||
      pageNumber < 1 ||
      !Number.isInteger(limitNumber) ||
      limitNumber < 1 ||
      limitNumber > 100
    ) {
      return res.status(400).json({
        message: "page must be positive and limit must be between 1 and 100"
      });
    }

    if (!["created_at", "due_date", "title", "status"].includes(sortBy)) {
      return res.status(400).json({
        message: "Invalid sortBy value"
      });
    }

    if (!["ASC", "DESC"].includes(order.toUpperCase())) {
      return res.status(400).json({
        message: "order must be ASC or DESC"
      });
    }

    const result = await getTasksByUser(req.user.id, {
      search,
      status,
      projectId: project_id,
      overdue,
      page: pageNumber,
      limit: limitNumber,
      sortBy,
      order: order.toUpperCase()
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getTask = async (req, res, next) => {
  try {
    const task = await getTaskById(
      req.params.id,
      req.user.id
    );

    if (!task) {
      return res.status(404).json({
        message: "Task not found"
      });
    }

    res.status(200).json({ task });
  } catch (error) {
    next(error);
  }
};

export const createTaskHandler = async (req, res, next) => {
  try {
    const {
      title,
      description,
      status = "pending",
      due_date,
      project_id,
      assigned_to
    } = req.body;

    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        message: "Task title is required"
      });
    }

    if (!Number.isInteger(Number(project_id)) || Number(project_id) < 1) {
      return res.status(400).json({
        message: "A valid project_id is required"
      });
    }

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid task status"
      });
    }

    if (due_date !== undefined && due_date !== null && !validDate(due_date)) {
      return res.status(400).json({
        message: "due_date must be a valid YYYY-MM-DD date or null"
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

    if (
      assigned_to !== undefined &&
      assigned_to !== null &&
      (!Number.isInteger(Number(assigned_to)) || Number(assigned_to) < 1)
    ) {
      return res.status(400).json({
        message: "assigned_to must be a positive user ID or null"
      });
    }

    const projectCheck = await pool.query(
      "SELECT id FROM projects WHERE id = $1 AND user_id = $2",
      [Number(project_id), req.user.id]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({
        message: "Project not found"
      });
    }

    const task = await createTask(
      title.trim(),
      description,
      status,
      due_date,
      Number(project_id),
      assigned_to === undefined || assigned_to === null
        ? null
        : Number(assigned_to)
    );

    res.status(201).json({
      message: "Task created successfully",
      task
    });
  } catch (error) {
    next(error);
  }
};

export const updateTaskHandler = async (req, res, next) => {
  try {
    const {
      title,
      description,
      status,
      due_date,
      project_id,
      assigned_to
    } = req.body;

    if (Object.keys(req.body).length === 0) {
      return res.status(400).json({
        message: "Provide at least one field to update"
      });
    }

    if (
      title !== undefined &&
      (typeof title !== "string" || !title.trim())
    ) {
      return res.status(400).json({
        message: "Title must be a non-empty string"
      });
    }

    if (
      status !== undefined &&
      !validStatuses.includes(status)
    ) {
      return res.status(400).json({
        message: "Invalid task status"
      });
    }

    if (
      due_date !== undefined &&
      due_date !== null &&
      !validDate(due_date)
    ) {
      return res.status(400).json({
        message: "due_date must be a valid YYYY-MM-DD date or null"
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

    if (
      project_id !== undefined &&
      (!Number.isInteger(Number(project_id)) || Number(project_id) < 1)
    ) {
      return res.status(400).json({
        message: "project_id must be a positive integer"
      });
    }

    if (
      assigned_to !== undefined &&
      assigned_to !== null &&
      (!Number.isInteger(Number(assigned_to)) || Number(assigned_to) < 1)
    ) {
      return res.status(400).json({
        message: "assigned_to must be a positive user ID or null"
      });
    }

    if (project_id !== undefined) {
      const projectCheck = await pool.query(
        "SELECT id FROM projects WHERE id = $1 AND user_id = $2",
        [Number(project_id), req.user.id]
      );

      if (projectCheck.rows.length === 0) {
        return res.status(404).json({
          message: "Project not found"
        });
      }
    }

    const task = await updateTask(
      req.params.id,
      req.user.id,
      {
        title: title === undefined ? undefined : title.trim(),
        description,
        status,
        due_date,
        project_id: project_id === undefined
          ? undefined
          : Number(project_id),
        assigned_to: assigned_to === undefined
          ? undefined
          : assigned_to === null
            ? null
            : Number(assigned_to)
      }
    );

    if (!task) {
      return res.status(404).json({
        message: "Task not found"
      });
    }

    res.status(200).json({
      message: "Task updated successfully",
      task
    });
  } catch (error) {
    next(error);
  }
};

export const deleteTaskHandler = async (req, res, next) => {
  try {
    const task = await deleteTask(
      req.params.id,
      req.user.id
    );

    if (!task) {
      return res.status(404).json({
        message: "Task not found"
      });
    }

    res.status(200).json({
      message: "Task deleted successfully",
      task
    });
  } catch (error) {
    next(error);
  }
};