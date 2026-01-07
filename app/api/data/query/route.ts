import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/server"
import { query } from "@/lib/mysql"

/**
 * Query data from LOCAL MySQL storage (synced_data table)
 * This endpoint ONLY reads from local storage, never from external databases
 * Data must be synced first using /api/sync/sync-table
 */
export async function POST(req: Request) {
  try {
    const { databaseId, tableName, filters, limit, offset, columns } = await req.json()
    
    console.log("[/api/data/query] Request:", { databaseId, tableName, filters })
    
    if (!databaseId || !tableName) {
      console.log("[/api/data/query] Missing required fields - databaseId:", databaseId, "tableName:", tableName)
      return NextResponse.json(
        { error: `databaseId and tableName are required. Received: databaseId=${databaseId}, tableName=${tableName}` },
        { status: 400 }
      )
    }
    
    const db = await getSupabaseServerClient()
    
    // Get synced_table record from local storage
    const { data: syncedTable, error: tableError } = await db
      .from("synced_tables")
      .select(["id", "last_data_synced_at"])
      .eq("database_id", databaseId)
      .eq("table_name", tableName)
      .single()
    
    console.log("[/api/data/query] Query result:", { syncedTable, tableError })
    
    if (tableError || !syncedTable) {
      console.log("[/api/data/query] Table not found - tableError:", tableError, "syncedTable:", syncedTable)
      return NextResponse.json(
        { 
          error: "Table not found or not synced. Please sync the table first using /api/sync/sync-table",
          debug: {
            receivedDatabaseId: databaseId,
            receivedTableName: tableName,
            queryError: tableError,
            queryResult: syncedTable
          }
        },
        { status: 404 }
      )
    }
    
    // Check if data has been synced
    if (!syncedTable.last_data_synced_at) {
      return NextResponse.json(
        { error: "No data synced yet. Please sync the table first using /api/sync/sync-table" },
        { status: 404 }
      )
    }
    
    // Build query for synced_data table
    let whereConditions: string[] = [`\`synced_table_id\` = ?`]
    let params: any[] = [syncedTable.id]
    
    // Apply filters if provided
    if (filters && Array.isArray(filters)) {
      filters.forEach((filter: any) => {
        if (filter.column && filter.operator && filter.value !== undefined) {
          // Filter on JSON data column using MySQL JSON functions
          const jsonPath = `JSON_UNQUOTE(JSON_EXTRACT(\`data\`, '$.${filter.column}'))`
          
          switch (filter.operator) {
            case "eq":
              whereConditions.push(`${jsonPath} = ?`)
              params.push(filter.value)
              break
            case "neq":
              whereConditions.push(`${jsonPath} != ?`)
              params.push(filter.value)
              break
            case "gt":
              whereConditions.push(`${jsonPath} > ?`)
              params.push(filter.value)
              break
            case "gte":
              whereConditions.push(`${jsonPath} >= ?`)
              params.push(filter.value)
              break
            case "lt":
              whereConditions.push(`${jsonPath} < ?`)
              params.push(filter.value)
              break
            case "lte":
              whereConditions.push(`${jsonPath} <= ?`)
              params.push(filter.value)
              break
            case "like":
              whereConditions.push(`${jsonPath} LIKE ?`)
              params.push(`%${filter.value}%`)
              break
            case "ilike":
              whereConditions.push(`LOWER(${jsonPath}) LIKE ?`)
              params.push(`%${String(filter.value).toLowerCase()}%`)
              break
          }
        }
      })
    }
    
    // Get count
    const countSql = `SELECT COUNT(*) as count FROM \`synced_data\` WHERE ${whereConditions.join(" AND ")}`
    const countResult = await query<{ count: number }>(countSql, params)
    const totalCount = countResult[0]?.count || 0
    
    // Build main query
    let sql = `SELECT \`data\` FROM \`synced_data\` WHERE ${whereConditions.join(" AND ")}`
    
    // Apply limit and offset
    if (limit) {
      sql += ` LIMIT ?`
      params.push(limit)
    }
    if (offset) {
      sql += ` OFFSET ?`
      params.push(offset)
    }
    
    const rows = await query<{ data: any }>(sql, params)
    
    // Extract data from JSON
    let extractedData = rows.map((row: any) => {
      // MySQL returns JSON as string, parse it
      if (typeof row.data === 'string') {
        return JSON.parse(row.data)
      }
      return row.data
    })
    
    // Filter columns if specified
    if (columns && Array.isArray(columns) && columns.length > 0) {
      extractedData = extractedData.map((row: any) => {
        const filtered: any = {}
        columns.forEach((col: string) => {
          if (row[col] !== undefined) {
            filtered[col] = row[col]
          }
        })
        return filtered
      })
    }
    
    return NextResponse.json({
      success: true,
      data: extractedData,
      count: totalCount,
      limit: limit || null,
      offset: offset || 0,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

