import mysql from "mysql2/promise"

// MySQL connection pool
let pool: mysql.Pool | null = null

export interface MySQLConfig {
  host: string
  port: number
  user: string
  password: string
  database: string
}

/**
 * Get MySQL connection pool
 * Uses environment variables or default local MySQL config
 */
export function getMySQLPool(): mysql.Pool {
  if (pool) {
    return pool
  }

  const config: MySQLConfig = {
    host: process.env.MYSQL_HOST || "localhost",
    port: parseInt(process.env.MYSQL_PORT || "3306"),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "1234qwer",
    database: process.env.MYSQL_DATABASE || "dashboard_vibe2",
  }

  pool = mysql.createPool({
    ...config,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  })

  return pool
}

/**
 * Execute a query and return results
 * Uses query() instead of execute() to avoid prepared statement issues
 */
export async function query<T = any>(
  sql: string,
  params?: any[]
): Promise<T[]> {
  const connection = await getMySQLPool().getConnection()
  try {
    // Use query() instead of execute() - it handles parameter substitution differently
    // and avoids "Incorrect arguments to mysqld_stmt_execute" errors
    const [rows] = await connection.query(sql, params || [])
    return rows as T[]
  } finally {
    connection.release()
  }
}

/**
 * Execute a query and return single row
 */
export async function queryOne<T = any>(
  sql: string,
  params?: any[]
): Promise<T | null> {
  const rows = await query<T>(sql, params)
  return rows[0] || null
}

/**
 * Execute an insert/update/delete and return affected rows
 * Uses parameterized queries with ? for values
 */
export async function execute(
  sql: string,
  params?: any[]
): Promise<{ affectedRows: number; insertId?: number }> {
  const connection = await getMySQLPool().getConnection()
  try {
    const [result] = await connection.execute(sql, params || []) as any
    return {
      affectedRows: result.affectedRows,
      insertId: result.insertId,
    }
  } finally {
    connection.release()
  }
}

