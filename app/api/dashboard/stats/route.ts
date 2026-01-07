import { NextResponse } from "next/server"
import { query } from "@/lib/mysql"

interface SyncedTable {
  id: string
  table_name: string
  database_id: string
}

/**
 * Get dashboard statistics and chart data from synced MySQL data
 * This endpoint aggregates data from synced_data table for dashboard charts
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const databaseId = searchParams.get("databaseId")
    const days = parseInt(searchParams.get("days") || "14")

    if (!databaseId) {
      return NextResponse.json(
        { error: "databaseId is required" },
        { status: 400 }
      )
    }

    // Get synced table IDs for this database
    const syncedTables = await query<SyncedTable>(
      `SELECT id, table_name FROM synced_tables WHERE database_id = ?`,
      [databaseId]
    )

    const tableMap = new Map<string, string>()
    syncedTables.forEach(t => tableMap.set(t.table_name, t.id))

    // Initialize response data
    const stats = {
      totalUsers: 0,
      activeUsers: 0,
      totalRevenue: 0,
      totalOrders: 0,
      completedOrders: 0,
      avgOrderValue: 0,
      totalProducts: 0,
      totalEvents: 0,
      userGrowth: 0,
      revenueGrowth: 0,
      orderGrowth: 0,
    }

    const chartData: {
      date: string
      users: number
      revenue: number
      orders: number
      events: number
    }[] = []

    // Get users stats
    if (tableMap.has("users")) {
      const usersTableId = tableMap.get("users")
      
      // Total users
      const totalUsersResult = await query<{ count: number }>(
        `SELECT COUNT(*) as count FROM synced_data WHERE synced_table_id = ?`,
        [usersTableId]
      )
      stats.totalUsers = totalUsersResult[0]?.count || 0

      // Active users
      const activeUsersResult = await query<{ count: number }>(
        `SELECT COUNT(*) as count FROM synced_data 
         WHERE synced_table_id = ? 
         AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.status')) = 'active'`,
        [usersTableId]
      )
      stats.activeUsers = activeUsersResult[0]?.count || 0

      // Users created in last 30 days vs previous 30 days for growth
      const recentUsersResult = await query<{ count: number }>(
        `SELECT COUNT(*) as count FROM synced_data 
         WHERE synced_table_id = ? 
         AND STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.created_at')), '%Y-%m-%dT%H:%i:%s') >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
        [usersTableId]
      )
      const prevUsersResult = await query<{ count: number }>(
        `SELECT COUNT(*) as count FROM synced_data 
         WHERE synced_table_id = ? 
         AND STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.created_at')), '%Y-%m-%dT%H:%i:%s') >= DATE_SUB(NOW(), INTERVAL 60 DAY)
         AND STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.created_at')), '%Y-%m-%dT%H:%i:%s') < DATE_SUB(NOW(), INTERVAL 30 DAY)`,
        [usersTableId]
      )
      const recentUsers = recentUsersResult[0]?.count || 0
      const prevUsers = prevUsersResult[0]?.count || 1
      stats.userGrowth = prevUsers > 0 ? ((recentUsers - prevUsers) / prevUsers) * 100 : 0
    }

    // Get orders stats
    if (tableMap.has("orders")) {
      const ordersTableId = tableMap.get("orders")

      // Total orders
      const totalOrdersResult = await query<{ count: number }>(
        `SELECT COUNT(*) as count FROM synced_data WHERE synced_table_id = ?`,
        [ordersTableId]
      )
      stats.totalOrders = totalOrdersResult[0]?.count || 0

      // Completed orders
      const completedOrdersResult = await query<{ count: number }>(
        `SELECT COUNT(*) as count FROM synced_data 
         WHERE synced_table_id = ? 
         AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.status')) = 'completed'`,
        [ordersTableId]
      )
      stats.completedOrders = completedOrdersResult[0]?.count || 0

      // Total revenue (sum of all order totals)
      const revenueResult = await query<{ total: string }>(
        `SELECT COALESCE(SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '$.total')) AS DECIMAL(10,2))), 0) as total 
         FROM synced_data WHERE synced_table_id = ?`,
        [ordersTableId]
      )
      stats.totalRevenue = parseFloat(revenueResult[0]?.total || "0")
      stats.avgOrderValue = stats.totalOrders > 0 ? stats.totalRevenue / stats.totalOrders : 0

      // Revenue growth (last 30 days vs previous 30 days)
      const recentRevenueResult = await query<{ total: string }>(
        `SELECT COALESCE(SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '$.total')) AS DECIMAL(10,2))), 0) as total 
         FROM synced_data 
         WHERE synced_table_id = ? 
         AND STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.created_at')), '%Y-%m-%dT%H:%i:%s') >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
        [ordersTableId]
      )
      const prevRevenueResult = await query<{ total: string }>(
        `SELECT COALESCE(SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '$.total')) AS DECIMAL(10,2))), 0) as total 
         FROM synced_data 
         WHERE synced_table_id = ? 
         AND STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.created_at')), '%Y-%m-%dT%H:%i:%s') >= DATE_SUB(NOW(), INTERVAL 60 DAY)
         AND STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.created_at')), '%Y-%m-%dT%H:%i:%s') < DATE_SUB(NOW(), INTERVAL 30 DAY)`,
        [ordersTableId]
      )
      const recentRevenue = parseFloat(recentRevenueResult[0]?.total || "0")
      const prevRevenue = parseFloat(prevRevenueResult[0]?.total || "1")
      stats.revenueGrowth = prevRevenue > 0 ? ((recentRevenue - prevRevenue) / prevRevenue) * 100 : 0

      // Order growth
      const recentOrdersResult = await query<{ count: number }>(
        `SELECT COUNT(*) as count FROM synced_data 
         WHERE synced_table_id = ? 
         AND STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.created_at')), '%Y-%m-%dT%H:%i:%s') >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
        [ordersTableId]
      )
      const prevOrdersResult = await query<{ count: number }>(
        `SELECT COUNT(*) as count FROM synced_data 
         WHERE synced_table_id = ? 
         AND STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.created_at')), '%Y-%m-%dT%H:%i:%s') >= DATE_SUB(NOW(), INTERVAL 60 DAY)
         AND STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.created_at')), '%Y-%m-%dT%H:%i:%s') < DATE_SUB(NOW(), INTERVAL 30 DAY)`,
        [ordersTableId]
      )
      const recentOrders = recentOrdersResult[0]?.count || 0
      const prevOrders = prevOrdersResult[0]?.count || 1
      stats.orderGrowth = prevOrders > 0 ? ((recentOrders - prevOrders) / prevOrders) * 100 : 0
    }

    // Get products count
    if (tableMap.has("products")) {
      const productsTableId = tableMap.get("products")
      const productsResult = await query<{ count: number }>(
        `SELECT COUNT(*) as count FROM synced_data WHERE synced_table_id = ?`,
        [productsTableId]
      )
      stats.totalProducts = productsResult[0]?.count || 0
    }

    // Get analytics events count
    if (tableMap.has("analytics_events")) {
      const eventsTableId = tableMap.get("analytics_events")
      const eventsResult = await query<{ count: number }>(
        `SELECT COUNT(*) as count FROM synced_data WHERE synced_table_id = ?`,
        [eventsTableId]
      )
      stats.totalEvents = eventsResult[0]?.count || 0
    }

    // Generate daily chart data for the last N days
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split("T")[0]
      const displayDate = date.toLocaleDateString("en-US", { month: "short", day: "numeric" })

      let dayUsers = 0
      let dayRevenue = 0
      let dayOrders = 0
      let dayEvents = 0

      // Daily user signups
      if (tableMap.has("users")) {
        const usersTableId = tableMap.get("users")
        const result = await query<{ count: number }>(
          `SELECT COUNT(*) as count FROM synced_data 
           WHERE synced_table_id = ? 
           AND DATE(STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.created_at')), '%Y-%m-%dT%H:%i:%s')) = ?`,
          [usersTableId, dateStr]
        )
        dayUsers = result[0]?.count || 0
      }

      // Daily orders and revenue
      if (tableMap.has("orders")) {
        const ordersTableId = tableMap.get("orders")
        
        const ordersResult = await query<{ count: number; total: string }>(
          `SELECT COUNT(*) as count, 
                  COALESCE(SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '$.total')) AS DECIMAL(10,2))), 0) as total
           FROM synced_data 
           WHERE synced_table_id = ? 
           AND DATE(STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.created_at')), '%Y-%m-%dT%H:%i:%s')) = ?`,
          [ordersTableId, dateStr]
        )
        dayOrders = ordersResult[0]?.count || 0
        dayRevenue = parseFloat(ordersResult[0]?.total || "0")
      }

      // Daily events
      if (tableMap.has("analytics_events")) {
        const eventsTableId = tableMap.get("analytics_events")
        const result = await query<{ count: number }>(
          `SELECT COUNT(*) as count FROM synced_data 
           WHERE synced_table_id = ? 
           AND DATE(STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.created_at')), '%Y-%m-%dT%H:%i:%s')) = ?`,
          [eventsTableId, dateStr]
        )
        dayEvents = result[0]?.count || 0
      }

      chartData.push({
        date: displayDate,
        users: dayUsers,
        revenue: Math.round(dayRevenue * 100) / 100,
        orders: dayOrders,
        events: dayEvents,
      })
    }

    return NextResponse.json({
      success: true,
      stats,
      chartData,
      syncedTables: syncedTables.map(t => t.table_name),
    })
  } catch (error: any) {
    console.error("Dashboard stats error:", error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

