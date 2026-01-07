/**
 * MySQL Database Access Layer
 * Provides Supabase-like interface for MySQL database
 * 
 * NOTE: This file should only be imported in server-side code.
 * For client-side, use API routes instead.
 */

// Dynamic import for server-side only
let mysqlUtils: typeof import("./mysql") | null = null

async function getMySQLUtils() {
  if (!mysqlUtils) {
    // Only import on server-side
    if (typeof window === 'undefined') {
      mysqlUtils = await import("./mysql")
    } else {
      throw new Error("MySQL utilities can only be used on the server side")
    }
  }
  return mysqlUtils
}

// Helper to convert MySQL rows to match Supabase format
function formatResponse<T>(rows: T[]): { data: T[] | null; error: null } {
  return { data: rows.length > 0 ? rows : null, error: null }
}

function formatError(error: any): { data: null; error: any } {
  return { data: null, error: { message: error.message } }
}

/**
 * MySQL Query Builder (Supabase-like interface)
 */
export class MySQLQueryBuilder<T = any> {
  private tableName: string
  private conditions: Array<{ column: string; operator: string; value: any }> = []
  private orderByColumn?: string
  private orderByDirection: "ASC" | "DESC" = "ASC"
  private limitCount?: number
  private offsetCount?: number
  private selectColumns: string[] = ["*"]
  private countMode: boolean = false

  constructor(tableName: string) {
    this.tableName = tableName
  }

  select(columns: string | string[] = "*", options?: { count?: string; head?: boolean }): this {
    if (options?.count) {
      this.countMode = true
      this.selectColumns = [`COUNT(${options.count === "exact" ? "*" : options.count}) as count`]
    } else if (options?.head) {
      // For head queries, we just want count, don't fetch data
      this.countMode = true
      this.selectColumns = [`COUNT(*) as count`]
    } else {
      // Handle both array and comma-separated string formats
      if (Array.isArray(columns)) {
        this.selectColumns = columns
      } else if (columns === "*") {
        this.selectColumns = ["*"]
      } else if (columns.includes(",")) {
        // Split comma-separated string into array and trim whitespace
        this.selectColumns = columns.split(",").map(c => c.trim())
      } else {
        this.selectColumns = [columns]
      }
    }
    return this
  }

  eq(column: string, value: any): this {
    this.conditions.push({ column, operator: "=", value })
    return this
  }

  neq(column: string, value: any): this {
    this.conditions.push({ column, operator: "!=", value })
    return this
  }

  gt(column: string, value: any): this {
    this.conditions.push({ column, operator: ">", value })
    return this
  }

  gte(column: string, value: any): this {
    this.conditions.push({ column, operator: ">=", value })
    return this
  }

  lt(column: string, value: any): this {
    this.conditions.push({ column, operator: "<", value })
    return this
  }

  lte(column: string, value: any): this {
    this.conditions.push({ column, operator: "<=", value })
    return this
  }

  like(column: string, value: string): this {
    this.conditions.push({ column, operator: "LIKE", value })
    return this
  }

  ilike(column: string, value: string): this {
    this.conditions.push({ column, operator: "LIKE", value: `%${value}%` })
    return this
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orderByColumn = column
    this.orderByDirection = options?.ascending === false ? "DESC" : "ASC"
    return this
  }

  limit(count: number): this {
    this.limitCount = count
    return this
  }

  range(from: number, to: number): this {
    this.offsetCount = from
    this.limitCount = to - from + 1
    return this
  }

  private buildWhereClause(): { sql: string; params: any[] } {
    if (this.conditions.length === 0) {
      return { sql: "", params: [] }
    }

    const conditions: string[] = []
    const params: any[] = []

    this.conditions.forEach((cond) => {
      // Handle JSON column paths (e.g., "data->>'column'")
      if (cond.column.includes("->>")) {
        // JSON extraction: data->>'column'
        const [jsonColumn, jsonPath] = cond.column.split("->>")
        const cleanJsonPath = jsonPath.replace(/'/g, "")
        conditions.push(`JSON_UNQUOTE(JSON_EXTRACT(\`${jsonColumn.trim()}\`, '$.${cleanJsonPath}')) ${cond.operator} ?`)
        params.push(cond.value)
      } else {
        // Regular column
        conditions.push(`\`${cond.column}\` ${cond.operator} ?`)
        params.push(cond.value)
      }
    })

    return {
      sql: `WHERE ${conditions.join(" AND ")}`,
      params,
    }
  }

  async executeQuery(): Promise<{ data: T[] | null; error: any; count?: number }> {
    try {
      const mysqlUtils = await getMySQLUtils()
      const { query: mysqlQuery } = mysqlUtils
      
      const selectCols = this.selectColumns.map(col => {
        if (col === "*") return "*"
        if (col.includes("COUNT(")) return col
        return `\`${col}\``
      }).join(", ")
      const { sql: whereSql, params: whereParams } = this.buildWhereClause()

      let sql = `SELECT ${selectCols} FROM \`${this.tableName}\` ${whereSql}`
      const params: any[] = [...whereParams]

      if (this.orderByColumn && !this.countMode) {
        sql += ` ORDER BY \`${this.orderByColumn}\` ${this.orderByDirection}`
      }

      // LIMIT and OFFSET - embed directly in SQL to avoid prepared statement issues
      // These are safe because they're integers we control
      if (this.limitCount && !this.countMode) {
        sql += ` LIMIT ${parseInt(String(this.limitCount), 10)}`
      }

      if (this.offsetCount !== undefined && !this.countMode) {
        sql += ` OFFSET ${parseInt(String(this.offsetCount), 10)}`
      }

      console.log("[MySQLQueryBuilder] Executing SQL:", sql)
      console.log("[MySQLQueryBuilder] With params:", params)
      console.log("[MySQLQueryBuilder] Param count:", params.length, "Placeholder count:", (sql.match(/\?/g) || []).length)

      const rows = await mysqlQuery<T>(sql, params)
      
      if (this.countMode) {
        const count = (rows[0] as any)?.count || 0
        return { data: null, error: null, count: Number(count) }
      }
      
      return formatResponse(rows)
    } catch (error: any) {
      console.error("[MySQLQueryBuilder] Error:", error.message)
      return formatError(error)
    }
  }

  async single(): Promise<{ data: T | null; error: any }> {
    try {
      const originalLimit = this.limitCount
      this.limitCount = 1
      const result = await this.executeQuery()
      this.limitCount = originalLimit
      
      if (result.error) return { data: null, error: result.error }
      return {
        data: result.data && result.data.length > 0 ? result.data[0] : null,
        error: null,
      }
    } catch (error: any) {
      return formatError(error)
    }
  }
}

/**
 * MySQL Client (Supabase-like interface)
 */
export class MySQLClient {
  from<T = any>(tableName: string): MySQLQueryBuilder<T> {
    return new MySQLQueryBuilder<T>(tableName)
  }

  async insert<T extends Record<string, any> = Record<string, any>>(
    tableName: string,
    data: T | T[]
  ): Promise<{ data: T[] | null; error: any }> {
    try {
      const mysqlUtils = await getMySQLUtils()
      const { query: mysqlQuery, execute: mysqlExecute } = mysqlUtils
      
      const records = Array.isArray(data) ? data : [data]
      if (records.length === 0) {
        return { data: [], error: null }
      }

      const keys = Object.keys(records[0])
      const placeholders = records.map(() => `(${keys.map(() => "?").join(", ")})`).join(", ")
      const values = records.flatMap((record) => keys.map((key) => {
        const val = (record as any)[key]
        // Convert objects/arrays to JSON strings for JSON columns
        if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
          return JSON.stringify(val)
        }
        return val
      }))

      const keyColumns = keys.map(k => `\`${k}\``).join(", ")
      const sql = `INSERT INTO \`${tableName}\` (${keyColumns}) VALUES ${placeholders}`
      const params: any[] = [...values]

      const result = await mysqlExecute(sql, params)

      // Fetch inserted records by insertId or return the records
      if (result.insertId && records.length === 1) {
        const inserted = await mysqlQuery<T>(
          `SELECT * FROM \`${tableName}\` WHERE id = ?`,
          [result.insertId]
        )
        return formatResponse(inserted)
      }

      return { data: records as T[], error: null }
    } catch (error: any) {
      return formatError(error)
    }
  }

  async update<T = any>(
    tableName: string,
    data: Partial<T>,
    conditions: Record<string, any>
  ): Promise<{ data: T[] | null; error: any }> {
    try {
      const mysqlUtils = await getMySQLUtils()
      const { query: mysqlQuery, execute: mysqlExecute } = mysqlUtils
      
      const setClause = Object.keys(data)
        .map((key) => `\`${key}\` = ?`)
        .join(", ")
      const whereClause = Object.keys(conditions)
        .map((key) => `\`${key}\` = ?`)
        .join(" AND ")

      const setValues = Object.values(data).map(val => {
        if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
          return JSON.stringify(val)
        }
        return val
      })
      const whereValues = Object.values(conditions)

      const sql = `UPDATE \`${tableName}\` SET ${setClause} WHERE ${whereClause}`
      const params: any[] = [...setValues, ...whereValues]

      await mysqlExecute(sql, params)

      // Fetch updated records
      const updated = await mysqlQuery<T>(
        `SELECT * FROM \`${tableName}\` WHERE ${whereClause}`,
        whereValues
      )
      return formatResponse(updated)
    } catch (error: any) {
      return formatError(error)
    }
  }

  async delete(
    tableName: string,
    conditions: Record<string, any>
  ): Promise<{ error: any }> {
    try {
      const mysqlUtils = await getMySQLUtils()
      const { execute: mysqlExecute } = mysqlUtils
      
      const whereClause = Object.keys(conditions)
        .map((key) => `\`${key}\` = ?`)
        .join(" AND ")
      const whereValues = Object.values(conditions)

      const sql = `DELETE FROM \`${tableName}\` WHERE ${whereClause}`
      const params: any[] = [...whereValues]

      await mysqlExecute(sql, params)
      return { error: null }
    } catch (error: any) {
      return formatError(error)
    }
  }
}

/**
 * Get MySQL client (server-side)
 */
export function getMySQLClient(): MySQLClient {
  return new MySQLClient()
}

// Note: For browser-side client, use getSupabaseBrowserClient() from "@/lib/client"
// That client uses API routes since browsers cannot connect directly to MySQL

