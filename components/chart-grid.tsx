"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { BarChart3, LineChartIcon, PieChart, TrendingUp, Users, DollarSign, Package, Activity } from "lucide-react"
import { Line, LineChart, Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

interface ChartGridProps {
  databaseId: string
}

interface DashboardStats {
  totalUsers: number
  activeUsers: number
  totalRevenue: number
  totalOrders: number
  completedOrders: number
  avgOrderValue: number
  totalProducts: number
  totalEvents: number
  userGrowth: number
  revenueGrowth: number
  orderGrowth: number
}

interface ChartDataPoint {
  date: string
  users: number
  revenue: number
  orders: number
  events: number
}

export function ChartGrid({ databaseId }: ChartGridProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [syncedTables, setSyncedTables] = useState<string[]>([])

  useEffect(() => {
    async function fetchDashboardData() {
      setLoading(true)
      setError(null)
      
      try {
        const response = await fetch(`/api/dashboard/stats?databaseId=${databaseId}&days=14`)
        const result = await response.json()
        
        if (!response.ok) {
          throw new Error(result.error || "Failed to fetch dashboard data")
        }
        
        setStats(result.stats)
        setChartData(result.chartData)
        setSyncedTables(result.syncedTables || [])
      } catch (err: any) {
        console.error("Error fetching dashboard data:", err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (databaseId) {
      fetchDashboardData()
    }
  }, [databaseId])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-500 mb-2">Error loading dashboard data</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">No data available</p>
      </div>
    )
  }

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  // Format percentage
  const formatGrowth = (value: number) => {
    const sign = value >= 0 ? "+" : ""
    return `${sign}${value.toFixed(1)}%`
  }

  const usersChartConfig = {
    users: {
      label: "New Users",
      color: "hsl(var(--chart-1))",
    },
  }

  const revenueChartConfig = {
    revenue: {
      label: "Revenue",
      color: "hsl(var(--chart-2))",
    },
  }

  const ordersChartConfig = {
    orders: {
      label: "Orders",
      color: "hsl(var(--chart-3))",
    },
  }

  const eventsChartConfig = {
    events: {
      label: "Events",
      color: "hsl(var(--chart-4))",
    },
  }

  // Calculate conversion rate (completed orders / total orders)
  const conversionRate = stats.totalOrders > 0 
    ? ((stats.completedOrders / stats.totalOrders) * 100).toFixed(1) 
    : "0.0"

  return (
    <div className="space-y-6">
      {/* Synced Tables Info */}
      {syncedTables.length > 0 && (
        <div className="text-xs text-muted-foreground">
          Data from: {syncedTables.join(", ")}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.totalUsers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              <span className={stats.userGrowth >= 0 ? "text-green-600" : "text-red-600"}>
                {formatGrowth(stats.userGrowth)}
              </span>{" "}
              from last month
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.activeUsers} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{formatCurrency(stats.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              <span className={stats.revenueGrowth >= 0 ? "text-green-600" : "text-red-600"}>
                {formatGrowth(stats.revenueGrowth)}
              </span>{" "}
              from last month
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Avg: {formatCurrency(stats.avgOrderValue)}/order
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <Package className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.totalOrders.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              <span className={stats.orderGrowth >= 0 ? "text-green-600" : "text-red-600"}>
                {formatGrowth(stats.orderGrowth)}
              </span>{" "}
              from last month
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.completedOrders} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{conversionRate}%</div>
            <p className="text-xs text-muted-foreground">
              Orders completed
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.totalProducts} products • {stats.totalEvents} events
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Daily New Users</CardTitle>
              <LineChartIcon className="w-5 h-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer config={usersChartConfig} className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line 
                    type="monotone" 
                    dataKey="users" 
                    stroke="var(--color-users)" 
                    strokeWidth={2}
                    dot={{ fill: "var(--color-users)", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Daily Revenue</CardTitle>
              <BarChart3 className="w-5 h-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer config={revenueChartConfig} className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(value) => `$${value}`} />
                  <ChartTooltip 
                    content={<ChartTooltipContent />}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, "Revenue"]}
                  />
                  <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Daily Orders</CardTitle>
              <TrendingUp className="w-5 h-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer config={ordersChartConfig} className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line 
                    type="monotone" 
                    dataKey="orders" 
                    stroke="var(--color-orders)" 
                    strokeWidth={2}
                    dot={{ fill: "var(--color-orders)", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Daily Events</CardTitle>
              <Activity className="w-5 h-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer config={eventsChartConfig} className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="events" fill="var(--color-events)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
