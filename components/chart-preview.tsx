"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Line, LineChart, Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, Area, AreaChart, Legend, Tooltip, Scatter, ScatterChart } from "recharts"
import { useSyncedData } from "@/hooks/use-synced-data"
import { Skeleton } from "@/components/ui/skeleton"

// Define a color palette for charts
const CHART_COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#f97316", // orange
  "#84cc16", // lime
  "#ec4899", // pink
  "#6366f1", // indigo
]

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

  // Helper function to get color by index
  const getColor = (index: number) => CHART_COLORS[index % CHART_COLORS.length]

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
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey={xAxisKey} tick={{ fill: '#6b7280', fontSize: 12 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Legend />
                {config.dataSource.yAxis.map((key, index) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={getColor(index)}
                    strokeWidth={2}
                    dot={{ fill: getColor(index), strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )
      case "bar":
        return (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey={xAxisKey} tick={{ fill: '#6b7280', fontSize: 12 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Legend />
                {config.dataSource.yAxis.map((key, index) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    fill={getColor(index)}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )
      case "area":
        return (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey={xAxisKey} tick={{ fill: '#6b7280', fontSize: 12 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Legend />
                {config.dataSource.yAxis.map((key, index) => (
                  <Area
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={getColor(index)}
                    fill={getColor(index)}
                    fillOpacity={0.3}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )
      case "scatter":
        // For scatter plots, both X and Y must be numeric
        // Try to parse X-axis as number, fallback to index if not numeric
        const scatterData = chartData.map((row: any, index) => {
          const xValue = row[xAxisKey]
          const yValue = parseFloat(row[config.dataSource.yAxis[0]]) || 0

          // Try to parse X as number, otherwise use index
          const xNumeric = parseFloat(xValue)
          const xFinal = isNaN(xNumeric) ? index : xNumeric

          return {
            x: xFinal,
            y: yValue,
            name: String(xValue), // Keep original for labels
            originalX: xValue,
          }
        })

        // Create a mapping for custom tick labels
        const xTickFormatter = (value: number) => {
          const item = scatterData.find(d => d.x === value)
          return item ? String(item.originalX) : String(value)
        }

        return (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart data={scatterData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="x"
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  tickFormatter={xTickFormatter}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  allowDecimals={false}
                />
                <YAxis
                  dataKey="y"
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  type="number"
                  name={config.dataSource.yAxis[0]}
                />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                  content={({ payload }) => {
                    if (!payload || payload.length === 0) return null
                    const data = payload[0].payload
                    return (
                      <div className="bg-white border border-gray-200 rounded-lg p-2 shadow-lg">
                        <p className="text-xs font-medium">{xAxisKey}: {data.originalX}</p>
                        <p className="text-xs text-muted-foreground">
                          {config.dataSource.yAxis[0]}: {data.y}
                        </p>
                      </div>
                    )
                  }}
                />
                <Legend />
                <Scatter
                  name={config.dataSource.yAxis[0]}
                  data={scatterData}
                  fill={getColor(0)}
                  shape="circle"
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )
      case "table":
        return (
          <div className="h-64 w-full overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-2 text-left font-medium">{xAxisKey}</th>
                  {config.dataSource.yAxis.map((key) => (
                    <th key={key} className="p-2 text-left font-medium">{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chartData.slice(0, 20).map((row: any, index) => (
                  <tr key={index} className="border-b">
                    <td className="p-2">{row[xAxisKey]}</td>
                    {config.dataSource.yAxis.map((key) => (
                      <td key={key} className="p-2">{row[key]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {chartData.length > 20 && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Showing first 20 of {chartData.length} rows
              </p>
            )}
          </div>
        )
      case "pie":
        // Pie chart uses first yAxis key
        const pieData = chartData.map((row: any) => ({
          name: String(row[xAxisKey] || ""),
          value: parseFloat(row[config.dataSource.yAxis[0]] || 0),
        }))
        return (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  labelLine={{ stroke: '#6b7280' }}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getColor(index)} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
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
