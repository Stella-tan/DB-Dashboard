import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/server"

/**
 * API route for browser-side MySQL queries
 * Browser can't connect directly to MySQL, so we use this API route
 */
export async function POST(req: Request) {
  try {
    const { table, columns, filters, orderBy, limit, offset, operation, data } = await req.json()
    
    if (!table) {
      return NextResponse.json(
        { error: "table is required" },
        { status: 400 }
      )
    }
    
    const db = await getSupabaseServerClient()
    
    // Handle INSERT operation
    if (operation === "insert") {
      if (!data) {
        return NextResponse.json(
          { error: "data is required for insert operation" },
          { status: 400 }
        )
      }
      const result = await db.insert(table, data)
      if (result.error) {
        return NextResponse.json({ error: result.error.message }, { status: 500 })
      }
      return NextResponse.json(result)
    }
    
    // Handle DELETE operation
    if (operation === "delete") {
      if (!filters || !Array.isArray(filters) || filters.length === 0) {
        return NextResponse.json(
          { error: "filters are required for delete operation" },
          { status: 400 }
        )
      }
      // Convert filters array to conditions object
      const conditions: Record<string, any> = {}
      filters.forEach((filter: any) => {
        if (filter.column && filter.operator === "eq" && filter.value !== undefined) {
          conditions[filter.column] = filter.value
        }
      })
      const result = await db.delete(table, conditions)
      if (result.error) {
        return NextResponse.json({ error: result.error.message }, { status: 500 })
      }
      return NextResponse.json(result)
    }
    
    // Handle SELECT operation (default)
    // Handle columns - convert comma-separated string to array
    let selectColumns = columns || "*"
    if (typeof selectColumns === 'string' && selectColumns !== '*') {
      selectColumns = selectColumns.split(',').map((c: string) => c.trim())
    }
    
    let query = db.from(table).select(selectColumns)
    
    // Apply filters
    if (filters && Array.isArray(filters)) {
      filters.forEach((filter: any) => {
        if (filter.column && filter.operator && filter.value !== undefined) {
          switch (filter.operator) {
            case "eq":
              query = query.eq(filter.column, filter.value)
              break
            case "neq":
              query = query.neq(filter.column, filter.value)
              break
            case "gt":
              query = query.gt(filter.column, filter.value)
              break
            case "gte":
              query = query.gte(filter.column, filter.value)
              break
            case "lt":
              query = query.lt(filter.column, filter.value)
              break
            case "lte":
              query = query.lte(filter.column, filter.value)
              break
            case "like":
              query = query.like(filter.column, filter.value)
              break
            case "ilike":
              query = query.ilike(filter.column, filter.value)
              break
          }
        }
      })
    }
    
    // Apply ordering
    if (orderBy && orderBy.column) {
      query = query.order(orderBy.column, { ascending: orderBy.ascending !== false })
    }
    
    // Apply limit and offset
    if (limit) {
      query = query.limit(limit)
    }
    if (offset) {
      query = query.range(offset, offset + (limit || 1000) - 1)
    }
    
    const result = await query.executeQuery()
    
    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 })
    }
    
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

