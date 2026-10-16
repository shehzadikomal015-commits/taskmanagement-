import pool from "../db.js";

const taskSelect = `
  SELECT
    t.id,
    t.title,
    t.description,
    t.status,
    t.due_date,
    t.project_id,
    t.assigned_to,
    t.created_at,
    t.updated_at,
    p.name AS project_name,
    u.name AS assigned_user_name
  FROM tasks t
  JOIN projects p ON p.id = t.project_id
  LEFT JOIN users u ON u.id = t.assigned_to
`;

export const createTask = async (
  title,
  description,
  status,
  dueDate,
  projectId,
  assignedTo
) => {
  const result = await pool.query(
    `INSERT INTO tasks
      (title, description, status, due_date, project_id, assigned_to)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      title,
      description ?? null,
      status ?? "pending",
      dueDate ?? null,
      projectId,
      assignedTo ?? null
    ]
  );

  return result.rows[0];
};

export const getTasksByUser = async (userId, options = {}) => {
  const {
    search,
    status,
    projectId,
    overdue,
    page = 1,
    limit = 10,
    sortBy = "created_at",
    order = "DESC"
  } = options;

  const conditions = ["p.user_id = $1"];
  const values = [userId];

  const addCondition = (sql, value) => {
    values.push(value);
    conditions.push(sql.replace("?", `$${values.length}`));
  };

  if (search) {
    addCondition(
      "(t.title ILIKE ? OR t.description ILIKE ?)",
      `%${search}%`
    );
    // Replace the two search placeholders with the same parameter.
    conditions[conditions.length - 1] =
      `(t.title ILIKE $${values.length} OR t.description ILIKE $${values.length})`;
  }

  if (status) {
    addCondition("t.status = ?", status);
  }

  if (projectId) {
    addCondition("t.project_id = ?", projectId);
  }

  if (overdue === "true") {
    conditions.push(
      "t.due_date < CURRENT_DATE AND t.status <> 'completed'"
    );
  }

  const allowedSortColumns = {
    created_at: "t.created_at",
    due_date: "t.due_date",
    title: "t.title",
    status: "t.status"
  };

  const sortColumn = allowedSortColumns[sortBy] || "t.created_at";
  const sortOrder = order === "ASC" ? "ASC" : "DESC";

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM tasks t
     JOIN projects p ON p.id = t.project_id
     WHERE ${conditions.join(" AND ")}`,
    values
  );

  const offset = (page - 1) * limit;
  const dataValues = [...values, limit, offset];

  const result = await pool.query(
    `${taskSelect}
     WHERE ${conditions.join(" AND ")}
     ORDER BY ${sortColumn} ${sortOrder} NULLS LAST
     LIMIT $${values.length + 1}
     OFFSET $${values.length + 2}`,
    dataValues
  );

  return {
    tasks: result.rows,
    total: countResult.rows[0].total,
    page,
    limit,
    totalPages: Math.ceil(countResult.rows[0].total / limit)
  };
};

export const getTaskById = async (taskId, userId) => {
  const result = await pool.query(
    `${taskSelect}
     WHERE t.id = $1 AND p.user_id = $2`,
    [taskId, userId]
  );

  return result.rows[0] || null;
};

export const updateTask = async (taskId, userId, data) => {
  const {
    title,
    description,
    status,
    due_date,
    project_id,
    assigned_to
  } = data;

  const result = await pool.query(
    `UPDATE tasks t
     SET title = COALESCE($3, t.title),
         description = CASE WHEN $4::boolean
           THEN $5::text ELSE t.description END,
         status = COALESCE($6, t.status),
         due_date = CASE WHEN $7::boolean
           THEN $8::date ELSE t.due_date END,
         project_id = COALESCE($9, t.project_id),
         assigned_to = CASE WHEN $10::boolean
           THEN $11::integer ELSE t.assigned_to END,
         updated_at = CURRENT_TIMESTAMP
     FROM projects p
     WHERE t.id = $1
       AND t.project_id = p.id
       AND p.user_id = $2
     RETURNING t.*`,
    [
      taskId,
      userId,
      title ?? null,
      description !== undefined,
      description ?? null,
      status ?? null,
      due_date !== undefined,
      due_date ?? null,
      project_id ?? null,
      assigned_to !== undefined,
      assigned_to ?? null
    ]
  );

  return result.rows[0] || null;
};

export const deleteTask = async (taskId, userId) => {
  const result = await pool.query(
    `DELETE FROM tasks t
     USING projects p
     WHERE t.id = $1
       AND t.project_id = p.id
       AND p.user_id = $2
     RETURNING t.*`,
    [taskId, userId]
  );

  return result.rows[0] || null;
};

export const getDashboardStats = async (userId) => {
  const result = await pool.query(
    `SELECT
       COUNT(t.id)::int AS total_tasks,
       COUNT(t.id) FILTER (
         WHERE t.status = 'completed'
       )::int AS completed_tasks,
       COUNT(t.id) FILTER (
         WHERE t.status = 'pending'
       )::int AS pending_tasks,
       COUNT(t.id) FILTER (
         WHERE t.status = 'in_progress'
       )::int AS in_progress_tasks,
       COUNT(t.id) FILTER (
         WHERE t.due_date < CURRENT_DATE
           AND t.status <> 'completed'
       )::int AS overdue_tasks
     FROM projects p
     LEFT JOIN tasks t ON t.project_id = p.id
     WHERE p.user_id = $1`,
    [userId]
  );

  return result.rows[0];
};