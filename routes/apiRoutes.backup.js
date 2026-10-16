import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../db.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

// Helper: validate positive integer IDs
const validId = (value) =>
  /^\d+$/.test(String(value)) && Number(value) > 0;

// ==================== AUTH & USERS ====================

// Register
router.post("/auth/register", async (req, res) => {
  const { name, email, password } = req.body;

  if (
    typeof name !== "string" || !name.trim() ||
    typeof email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    typeof password !== "string" || password.length < 8
  ) {
    return res.status(400).json({
      message: "Name, valid email and password (minimum 8 characters) are required"
    });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, created_at`,
      [name.trim(), email.trim().toLowerCase(), passwordHash]
    );

    res.status(201).json({
      message: "User registered successfully",
      user: result.rows[0]
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Email already exists" });
    }

    console.error("Register error:", error.message);
    res.status(500).json({ message: "Failed to register user" });
  }
});

// Login
router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({
      message: "Email and password are required"
    });
  }

  try {
    const result = await pool.query(
      "SELECT id, name, email, password_hash FROM users WHERE email = $1",
      [email.trim().toLowerCase()]
    );

    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ message: "Failed to login" });
  }
});

// Read own user profile
router.get("/users/me", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, created_at FROM users WHERE id = $1",
      [req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Profile error:", error.message);
    res.status(500).json({ message: "Failed to get profile" });
  }
});

// Update own profile
router.patch("/users/me", authenticate, async (req, res) => {
  const { name, email } = req.body;

  if (name === undefined && email === undefined) {
    return res.status(400).json({
      message: "Provide name or email to update"
    });
  }

  if (
    (name !== undefined &&
      (typeof name !== "string" || !name.trim())) ||
    (email !== undefined &&
      (typeof email !== "string" ||
       !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))
  ) {
    return res.status(400).json({ message: "Invalid name or email" });
  }

  try {
    const result = await pool.query(
      `UPDATE users
       SET name = COALESCE($1, name),
           email = COALESCE($2, email)
       WHERE id = $3
       RETURNING id, name, email, created_at`,
      [
        name === undefined ? null : name.trim(),
        email === undefined ? null : email.trim().toLowerCase(),
        req.user.id
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "Profile updated", user: result.rows[0] });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Email already exists" });
    }

    console.error("Profile update error:", error.message);
    res.status(500).json({ message: "Failed to update profile" });
  }
});

// Delete own account (permanent)
router.delete("/users/me", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM users WHERE id = $1 RETURNING id, name, email",
      [req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      message: "Account deleted",
      user: result.rows[0]
    });
  } catch (error) {
    console.error("Account deletion error:", error.message);
    res.status(500).json({ message: "Failed to delete account" });
  }
});

// ==================== PROJECTS CRUD ====================

// Create project
router.post("/projects", authenticate, async (req, res) => {
  const { name, description = null } = req.body;

  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ message: "Project name is required" });
  }

  if (
    description !== null &&
    typeof description !== "string"
  ) {
    return res.status(400).json({ message: "Invalid description" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO projects (name, description, user_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name.trim(), description, req.user.id]
    );

    res.status(201).json({
      message: "Project created",
      project: result.rows[0]
    });
  } catch (error) {
    console.error("Create project error:", error.message);
    res.status(500).json({ message: "Failed to create project" });
  }
});

// Read all own projects
router.get("/projects", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.name, p.description, p.created_at,
              COUNT(t.id)::int AS total_tasks
       FROM projects p
       LEFT JOIN tasks t ON t.project_id = p.id
       WHERE p.user_id = $1
       GROUP BY p.id
       ORDER BY p.id DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Get projects error:", error.message);
    res.status(500).json({ message: "Failed to get projects" });
  }
});

// Read one project
router.get("/projects/:id", authenticate, async (req, res) => {
  const { id } = req.params;

  if (!validId(id)) {
    return res.status(400).json({ message: "Invalid project ID" });
  }

  try {
    const result = await pool.query(
      `SELECT p.id, p.name, p.description, p.created_at,
              COUNT(t.id)::int AS total_tasks
       FROM projects p
       LEFT JOIN tasks t ON t.project_id = p.id
       WHERE p.id = $1 AND p.user_id = $2
       GROUP BY p.id`,
      [Number(id), req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Project not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Get project error:", error.message);
    res.status(500).json({ message: "Failed to get project" });
  }
});

// Update project
router.patch("/projects/:id", authenticate, async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  if (!validId(id)) {
    return res.status(400).json({ message: "Invalid project ID" });
  }

  if (name === undefined && description === undefined) {
    return res.status(400).json({ message: "Provide fields to update" });
  }

  if (
    (name !== undefined &&
      (typeof name !== "string" || !name.trim())) ||
    (description !== undefined &&
      description !== null && typeof description !== "string")
  ) {
    return res.status(400).json({ message: "Invalid project data" });
  }

  try {
    const result = await pool.query(
      `UPDATE projects
       SET name = COALESCE($1, name),
           description = COALESCE($2, description)
       WHERE id = $3 AND user_id = $4
       RETURNING *`,
      [
        name === undefined ? null : name.trim(),
        description === undefined ? null : description,
        Number(id),
        req.user.id
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Project not found" });
    }

    res.json({ message: "Project updated", project: result.rows[0] });
  } catch (error) {
    console.error("Update project error:", error.message);
    res.status(500).json({ message: "Failed to update project" });
  }
});

// Delete project
router.delete("/projects/:id", authenticate, async (req, res) => {
  const { id } = req.params;

  if (!validId(id)) {
    return res.status(400).json({ message: "Invalid project ID" });
  }

  try {
    const result = await pool.query(
      `DELETE FROM projects
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [Number(id), req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Project not found" });
    }

    res.json({ message: "Project deleted", project: result.rows[0] });
  } catch (error) {
    console.error("Delete project error:", error.message);
    res.status(500).json({ message: "Failed to delete project" });
  }
});

// ==================== TASKS CRUD ====================

// Create task
router.post("/tasks", authenticate, async (req, res) => {
  const {
    title,
    description = null,
    status = "pending",
    due_date = null,
    project_id,
    assigned_to = null
  } = req.body;

  if (typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ message: "Task title is required" });
  }

  if (!validId(project_id)) {
    return res.status(400).json({ message: "Valid project_id is required" });
  }

  if (!["pending", "in_progress", "completed"].includes(status)) {
    return res.status(400).json({ message: "Invalid task status" });
  }

  if (description !== null && typeof description !== "string") {
    return res.status(400).json({ message: "Invalid description" });
  }

  if (
    due_date !== null &&
    (typeof due_date !== "string" ||
     !/^\d{4}-\d{2}-\d{2}$/.test(due_date) ||
     Number.isNaN(Date.parse(due_date)) ||
     new Date(due_date).toISOString().slice(0, 10) !== due_date)
  ) {
    return res.status(400).json({ message: "Invalid due_date; use YYYY-MM-DD" });
  }

  if (assigned_to !== null && !validId(assigned_to)) {
    return res.status(400).json({ message: "Invalid assigned_to user ID" });
  }

  try {
    const project = await pool.query(
      "SELECT id FROM projects WHERE id = $1 AND user_id = $2",
      [Number(project_id), req.user.id]
    );

    if (!project.rows.length) {
      return res.status(404).json({ message: "Project not found" });
    }

    if (assigned_to !== null) {
      const assignee = await pool.query(
        "SELECT id FROM users WHERE id = $1",
        [Number(assigned_to)]
      );

      if (!assignee.rows.length) {
        return res.status(400).json({ message: "Assigned user not found" });
      }
    }

    const result = await pool.query(
      `INSERT INTO tasks
         (title, description, status, due_date, project_id, assigned_to)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        title.trim(),
        description,
        status,
        due_date,
        Number(project_id),
        assigned_to === null ? null : Number(assigned_to)
      ]
    );

    res.status(201).json({ message: "Task created", task: result.rows[0] });
  } catch (error) {
    console.error("Create task error:", error.message);
    res.status(500).json({ message: "Failed to create task" });
  }
});

// Read tasks: search, filters, sorting, pagination, JOIN
router.get("/tasks", authenticate, async (req, res) => {
  const {
    search = "",
    status,
    project_id,
    overdue,
    page = "1",
    limit = "10",
    sortBy = "created_at",
    order = "desc"
  } = req.query;

  const pageNum = Number(page);
  const limitNum = Number(limit);

  if (
    !Number.isInteger(pageNum) || pageNum < 1 ||
    !Number.isInteger(limitNum) || limitNum < 1 || limitNum > 100
  ) {
    return res.status(400).json({
      message: "page must be >= 1 and limit must be between 1 and 100"
    });
  }

  if (
    status !== undefined &&
    !["pending", "in_progress", "completed"].includes(status)
  ) {
    return res.status(400).json({ message: "Invalid status filter" });
  }

  if (project_id !== undefined && !validId(project_id)) {
    return res.status(400).json({ message: "Invalid project_id" });
  }

  if (overdue !== undefined && !["true", "false"].includes(overdue)) {
    return res.status(400).json({ message: "overdue must be true or false" });
  }

  const sortColumns = {
    created_at: "t.created_at",
    due_date: "t.due_date",
    title: "t.title",
    status: "t.status"
  };

  if (!sortColumns[sortBy] || !["asc", "desc"].includes(order.toLowerCase())) {
    return res.status(400).json({ message: "Invalid sortBy or order" });
  }

  try {
    const conditions = ["p.user_id = $1"];
    const values = [req.user.id];

    const addFilter = (sql, value) => {
      values.push(value);
      conditions.push(sql.replace("?", `$${values.length}`));
    };

    if (search.trim()) {
  values.push(`%${search.trim()}%`, `%${search.trim()}%`);

  const firstSearchParam = values.length - 1;

  conditions.push(
    `(t.title ILIKE $${firstSearchParam} OR
      COALESCE(t.description, '') ILIKE $${firstSearchParam + 1})`
  );
}
    if (status) addFilter("t.status = ?", status);
    if (project_id) addFilter("t.project_id = ?", Number(project_id));

    if (overdue === "true") {
      conditions.push("t.due_date < CURRENT_DATE AND t.status <> 'completed'");
    } else if (overdue === "false") {
      conditions.push(
        "(t.due_date IS NULL OR t.due_date >= CURRENT_DATE OR t.status = 'completed')"
      );
    }

    const where = conditions.join(" AND ");
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       WHERE ${where}`,
      values
    );

    const offset = (pageNum - 1) * limitNum;
    const dataValues = [...values, limitNum, offset];

    const result = await pool.query(
      `SELECT t.id, t.title, t.description, t.status, t.due_date,
              t.project_id, t.assigned_to, t.created_at, t.updated_at,
              p.name AS project_name,
              u.name AS assigned_user_name
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN users u ON u.id = t.assigned_to
       WHERE ${where}
       ORDER BY ${sortColumns[sortBy]} ${order.toUpperCase()} NULLS LAST
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      dataValues
    );

    res.json({
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: countResult.rows[0].total,
        totalPages: Math.ceil(countResult.rows[0].total / limitNum)
      },
      tasks: result.rows
    });
  } catch (error) {
    console.error("Get tasks error:", error.message);
    res.status(500).json({ message: "Failed to get tasks" });
  }
});

// Read one task
router.get("/tasks/:id", authenticate, async (req, res) => {
  const { id } = req.params;

  if (!validId(id)) {
    return res.status(400).json({ message: "Invalid task ID" });
  }

  try {
    const result = await pool.query(
      `SELECT t.*, p.name AS project_name, u.name AS assigned_user_name
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN users u ON u.id = t.assigned_to
       WHERE t.id = $1 AND p.user_id = $2`,
      [Number(id), req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Task not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Get task error:", error.message);
    res.status(500).json({ message: "Failed to get task" });
  }
});

// Update task
router.patch("/tasks/:id", authenticate, async (req, res) => {
  const { id } = req.params;
  const { title, description, status, due_date, project_id, assigned_to } = req.body;

  if (!validId(id)) {
    return res.status(400).json({ message: "Invalid task ID" });
  }

  if (
    title === undefined && description === undefined &&
    status === undefined && due_date === undefined &&
    project_id === undefined && assigned_to === undefined
  ) {
    return res.status(400).json({ message: "Provide fields to update" });
  }

  if (
    (title !== undefined && (typeof title !== "string" || !title.trim())) ||
    (description !== undefined && description !== null && typeof description !== "string") ||
    (status !== undefined && !["pending", "in_progress", "completed"].includes(status)) ||
    (project_id !== undefined && !validId(project_id)) ||
    (assigned_to !== undefined && assigned_to !== null && !validId(assigned_to)) ||
    (due_date !== undefined && due_date !== null &&
      (typeof due_date !== "string" ||
       !/^\d{4}-\d{2}-\d{2}$/.test(due_date) ||
       Number.isNaN(Date.parse(due_date)) ||
       new Date(due_date).toISOString().slice(0, 10) !== due_date))
  ) {
    return res.status(400).json({ message: "Invalid task data" });
  }

  try {
    const current = await pool.query(
      `SELECT t.* FROM tasks t
       JOIN projects p ON p.id = t.project_id
       WHERE t.id = $1 AND p.user_id = $2`,
      [Number(id), req.user.id]
    );

    if (!current.rows.length) {
      return res.status(404).json({ message: "Task not found" });
    }

    const old = current.rows[0];
    const nextProject = project_id === undefined ? old.project_id : Number(project_id);

    const project = await pool.query(
      "SELECT id FROM projects WHERE id = $1 AND user_id = $2",
      [nextProject, req.user.id]
    );

    if (!project.rows.length) {
      return res.status(400).json({ message: "Project not found or not owned by you" });
    }

    const nextAssignee = assigned_to === undefined ? old.assigned_to : assigned_to;

    if (nextAssignee !== null) {
      const user = await pool.query(
        "SELECT id FROM users WHERE id = $1",
        [Number(nextAssignee)]
      );

      if (!user.rows.length) {
        return res.status(400).json({ message: "Assigned user not found" });
      }
    }

    const result = await pool.query(
      `UPDATE tasks
       SET title = $1,
           description = $2,
           status = $3,
           due_date = $4,
           project_id = $5,
           assigned_to = $6,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [
        title === undefined ? old.title : title.trim(),
        description === undefined ? old.description : description,
        status === undefined ? old.status : status,
        due_date === undefined ? old.due_date : due_date,
        nextProject,
        nextAssignee === null ? null : Number(nextAssignee),
        Number(id)
      ]
    );

    res.json({ message: "Task updated", task: result.rows[0] });
  } catch (error) {
    console.error("Update task error:", error.message);
    res.status(500).json({ message: "Failed to update task" });
  }
});

// Delete task
router.delete("/tasks/:id", authenticate, async (req, res) => {
  const { id } = req.params;

  if (!validId(id)) {
    return res.status(400).json({ message: "Invalid task ID" });
  }

  try {
    const result = await pool.query(
      `DELETE FROM tasks t
       USING projects p
       WHERE t.project_id = p.id
         AND t.id = $1 AND p.user_id = $2
       RETURNING t.*`,
      [Number(id), req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Task not found" });
    }

    res.json({ message: "Task deleted", task: result.rows[0] });
  } catch (error) {
    console.error("Delete task error:", error.message);
    res.status(500).json({ message: "Failed to delete task" });
  }
});

// ==================== DASHBOARD ====================

router.get("/dashboard", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         COUNT(t.id)::int AS total_tasks,
         COUNT(t.id) FILTER (WHERE t.status = 'completed')::int AS completed_tasks,
         COUNT(t.id) FILTER (WHERE t.status = 'pending')::int AS pending_tasks,
         COUNT(t.id) FILTER (WHERE t.status = 'in_progress')::int AS in_progress_tasks,
         COUNT(t.id) FILTER (
           WHERE t.due_date < CURRENT_DATE
             AND t.status <> 'completed'
         )::int AS overdue_tasks
       FROM projects p
       LEFT JOIN tasks t ON t.project_id = p.id
       WHERE p.user_id = $1`,
      [req.user.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Dashboard error:", error.message);
    res.status(500).json({ message: "Failed to load dashboard" });
  }
});

export default router; 