import pool from "../db.js";

export const createProject = async (userId, name, description) => {
  const result = await pool.query(
    `INSERT INTO projects (user_id, name, description)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [userId, name, description ?? null]
  );

  return result.rows[0];
};

export const getProjectsByUser = async (userId) => {
  const result = await pool.query(
    `SELECT p.id, p.name, p.description, p.user_id, p.created_at,
            COUNT(t.id)::int AS task_count
     FROM projects p
     LEFT JOIN tasks t ON t.project_id = p.id
     WHERE p.user_id = $1
     GROUP BY p.id
     ORDER BY p.created_at DESC`,
    [userId]
  );

  return result.rows;
};

export const getProjectById = async (projectId, userId) => {
  const result = await pool.query(
    `SELECT p.id, p.name, p.description, p.user_id, p.created_at,
            COUNT(t.id)::int AS task_count
     FROM projects p
     LEFT JOIN tasks t ON t.project_id = p.id
     WHERE p.id = $1 AND p.user_id = $2
     GROUP BY p.id`,
    [projectId, userId]
  );

  return result.rows[0] || null;
};

export const updateProject = async (
  projectId,
  userId,
  name,
  description
) => {
  const result = await pool.query(
    `UPDATE projects
     SET name = COALESCE($3, name),
         description = CASE
           WHEN $4::boolean THEN $5::text
           ELSE description
         END
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [
      projectId,
      userId,
      name ?? null,
      description !== undefined,
      description ?? null
    ]
  );

  return result.rows[0] || null;
};

export const deleteProject = async (projectId, userId) => {
  const result = await pool.query(
    `DELETE FROM projects
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [projectId, userId]
  );

  return result.rows[0] || null;
};