
import pool from "../db.js";

// Register a new user
export const createUser = async (name, email, passwordHash) => {
  const query = `
    INSERT INTO users (name, email, password_hash)
    VALUES ($1, $2, $3)
    RETURNING id, name, email, created_at
  `;

  const result = await pool.query(query, [name, email, passwordHash]);
  return result.rows[0];
};

// Find a user by email (used during login and registration checks)
export const findUserByEmail = async (email) => {
  const query = `
    SELECT id, name, email, password_hash, created_at
    FROM users
    WHERE email = $1
  `;

  const result = await pool.query(query, [email]);
  return result.rows[0] || null;
};

// Find a user by ID
export const findUserById = async (id) => {
  const query = `
    SELECT id, name, email, created_at
    FROM users
    WHERE id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
};

// Update a user's name and email
export const updateUser = async (id, name, email) => {
  const query = `
    UPDATE users
    SET
      name = COALESCE($2, name),
      email = COALESCE($3, email)
    WHERE id = $1
    RETURNING id, name, email, created_at
  `;

  const result = await pool.query(query, [id, name, email]);
  return result.rows[0] || null;
};

// Delete a user
export const deleteUser = async (id) => {
  const query = `
    DELETE FROM users
    WHERE id = $1
    RETURNING id, name, email
  `;

  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
};