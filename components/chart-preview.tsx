"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Line, LineChart, Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, Area, AreaChart } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { useSyncedData } from "@/hooks/use-synced-data"
import { Skeleton } from "@/components/ui/skeleton"

interface ChartPreviewProps {
  config: {
    title: string
    chartType: string
    dataSource: {
      table: string
      xAxis: string
      yAxis: string[]
    }
    filters: any[]
    aggregation: string
    groupBy: string
  }
  databaseId: string | null
}

export function ChartPreview({ config, databaseId }: ChartPreviewProps) {
  // Fetch real data
  const { data: rawData, loading, error } = useSyncedData({
    databaseId,
    tableName: config.dataSource.table || null,
    filters: config.filters.map((f) => ({
      column: f.field,
      operator: f.operator as any,
      value: f.value,
    })),
    limit: 1000,
  })
  // Transform data for charts
  const chartData = useMemo(() => {
    console.log("[ChartPreview] rawData:", rawData?.length, "rows")
    console.log("[ChartPreview] xAxis:", config.dataSource.xAxis, "yAxis:", config.dataSource.yAxis)
    
    if (!rawData || rawData.length === 0) {
      console.log("[ChartPreview] No rawData available")
      return []
    }
    
    const xAxisKey = config.dataSource.xAxis
    const yAxisKeys = config.dataSource.yAxis || []
    
    if (!xAxisKey || yAxisKeys.length === 0) {
      console.log("[ChartPreview] No axis configured, returning first 10 rows")
      return rawData.slice(0, 10) // Return first 10 rows if no axis configured
    }
    
    // Group data if groupBy is specified
    if (config.groupBy) {
      const grouped: Record<string, any> = {}
      
      rawData.forEach((row: any) => {
        const groupKey = String(row[config.groupBy] || "Unknown")
        if (!grouped[groupKey]) {
          grouped[groupKey] = {
            [xAxisKey]: groupKey,
            ...yAxisKeys.reduce((acc, key) => {
              acc[key] = 0
              return acc
            }, {} as any),
          }
        }
        
        yAxisKeys.forEach((key) => {
          const value = parseFloat(row[key]) || 0
          if (config.aggregation === "sum") {
            grouped[groupKey][key] += value
          } else if (config.aggregation === "avg") {
            grouped[groupKey][key] = (grouped[groupKey][key] + value) / 2
          } else if (config.aggregation === "count") {
            grouped[groupKey][key] += 1
          } else if (config.aggregation === "min") {
            grouped[groupKey][key] = Math.min(grouped[groupKey][key], value)
          } else if (config.aggregation === "max") {
            grouped[groupKey][key] = Math.max(grouped[groupKey][key], value)
          }
        })
      })
      
      return Object.values(grouped)
    }
    
    // Simple mapping without grouping
    return rawData.map((row: any) => {
      const mapped: any = {
        [xAxisKey]: row[xAxisKey] || "",
      }
      yAxisKeys.forEach((key) => {
        mapped[key] = parseFloat(row[key]) || 0
      })
      return mapped
    })
  }, [rawData, config.dataSource.xAxis, config.dataSource.yAxis, config.groupBy, config.aggregation])

  // Build chart config
  const chartConfig = useMemo(() => {
    const configObj: any = {}
    config.dataSource.yAxis.forEach((key, index) => {
      configObj[key] = {
        label: key,
        color: `hsl(var(--chart-${(index % 5) + 1}))`,
      }
    })
    return configObj
  }, [config.dataSource.yAxis])

  const renderChart = () => {
    console.log("[ChartPreview] renderChart - loading:", loading, "error:", error, "table:", config.dataSource.table, "chartData length:", chartData.length)
    
    if (loading) {
      return <Skeleton className="h-64 w-full" />
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-64 text-destructive">
          Error: {error}
        </div>
      )
    }

    if (!config.dataSource.table) {
      return (
        <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
          Select a data source to preview the chart
        </div>
      )
    }

    if (chartData.length === 0) {
      return (
        <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
          No data available. Please sync the table first.
        </div>
      )
    }

    const xAxisKey = config.dataSource.xAxis || Object.keys(chartData[0] || {})[0]

    switch (config.chartType) {
      case "line":
        return (
          <ChartContainer config={chartConfig} className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={xAxisKey} />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                {config.dataSource.yAxis.map((key) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={`var(--color-${key})`}
                    strokeWidth={2}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        )
      case "bar":
        return (
          <ChartContainer config={chartConfig} className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={xAxisKey} />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                {config.dataSource.yAxis.map((key) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    fill={`var(--color-${key})`}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        )
      case "area":
        return (
          <ChartContainer config={chartConfig} className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={xAxisKey} />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                {config.dataSource.yAxis.map((key) => (
                  <Area
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={`var(--color-${key})`}
                    fill={`var(--color-${key})`}
                    fillOpacity={0.6}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>
        )
      case "pie":
        // Pie chart uses first yAxis key
        const pieData = chartData.map((row: any) => ({
          name: String(row[xAxisKey] || ""),
          value: parseFloat(row[config.dataSource.yAxis[0]] || 0),
        }))
        return (
          <ChartContainer config={chartConfig} className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>
        )
      default:
        return (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            Preview for {config.chartType} chart
          </div>
        )
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{config.title || "Chart Preview"}</CardTitle>
      </CardHeader>
      <CardContent>
        {renderChart()}
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Table:</span>
            <span className="font-medium">{config.dataSource.table || "Not selected"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Aggregation:</span>
            <span className="font-medium">{config.aggregation}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Filters:</span>
            <span className="font-medium">{config.filters.length} active</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
