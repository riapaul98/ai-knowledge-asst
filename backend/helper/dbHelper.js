import pool from "../services/database.js";
export async function runQuery(query, values) {
  try {
    return await pool.query(query, values);
  } catch (err) {
    console.log(err);
    const error = new Error("Database service error");
    error.code = "DB_SERVICE_ERROR";
    throw error;
  }
}

export async function runClientQuery(client, query, values) {
  try {
    return await client.query(query, values);
  } catch (err) {
    console.log(err);
    const error = new Error("Database service error");
    error.code = "DB_SERVICE_ERROR";
    throw error;
  }
}

export async function getDBClient() {
  try {
    return await pool.connect();
  } catch (err) {
    console.log(err);
    const error = new Error("Database service error");
    error.code = "DB_SERVICE_ERROR";
    throw error;
  }
}
