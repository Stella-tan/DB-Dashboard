"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { 
  Users, DollarSign, Package, Activity, TrendingUp, Wallet, 
  CheckCircle, Clock, RefreshCw, Sparkles, AlertCircle,
  BarChart3, LineChartIcon, PieChart as PieChartIcon, Zap,
  Code, Copy, Check, Trash2, Loader2
} from "lucide-react"
import { 
  Line, LineChart, Bar, BarChart, Pie, PieChart,
  Area, AreaChart, CartesianGrid, XAxis, YAxis, 
  ResponsiveContainer, Cell, Legend
} from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

interface AIChartGridProps {
  databaseId: string
  refreshKey?: number
}

interface ChartConfig {
  id: string
  title: string
  type: "line" | "bar" | "pie" | "area" | "stat"
  table: string
  columns: {
    x?: string
    y: string
    groupBy?: string
  }
  aggregation: string
  dateRange?: string
}

interface KPIConfig {
  id: string
  title: string
  table: string
  column: string
  aggregation: string
  icon: string
  compareWith?: string
}

interface DashboardConfig {
  charts: ChartConfig[]
  kpis: KPIConfig[]
}

interface ChartData {
  data: Record<string, unknown>[]
  loading: boolean
  error?: string
}

interface KPIData {
  value: number
  growth: number
  loading: boolean
  error?: string
}

interface CustomChart {
  id: string
  config: {
    title: string
    chartType: string
    dataSource: {
      table: string
      xAxis: string
      yAxis: string[]
    }
    aggregation: string
    groupBy: string
  }
  data: Record<string, unknown>[]
  computedAt: string
}

const COLORS = [
  "#3b82f6",  // Blue
  "#10b981",  // Emerald/Teal
  "#f59e0b",  // Amber/Orange
  "#ef4444",  // Red
  "#8b5cf6",  // Purple
  "#06b6d4",  // Cyan
  "#84cc16",  // Lime Green
  "#f97316",  // Orange
  "#ec4899",  // Pink
  "#14b8a6",  // Teal
]

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  "users": Users,
  "dollar-sign": DollarSign,
  "package": Package,
  "activity": Activity,
  "trending-up": TrendingUp,
  "wallet": Wallet,
  "check-circle": CheckCircle,
  "clock": Clock,
}

/**
 * Generate SQL preview for a chart based on its configuration
 */
function generateChartSQL(chart: ChartConfig, databaseId: string): string {
  const { table, columns, aggregation, type } = chart
  const xColumn = columns?.x
  const yColumn = columns?.y || 'id'
  const groupBy = columns?.groupBy

  // Build aggregation expression
  let aggExpr: string
  switch (aggregation) {
    case 'count':
      aggExpr = 'COUNT(*)'
      break
    case 'sum':
      aggExpr = `SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '$.${yColumn}')) AS DECIMAL(20,2)))`
      break
    case 'avg':
      aggExpr = `AVG(CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '$.${yColumn}')) AS DECIMAL(20,2)))`
      break
    case 'min':
      aggExpr = `MIN(CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '$.${yColumn}')) AS DECIMAL(20,2)))`
      break
    case 'max':
      aggExpr = `MAX(CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '$.${yColumn}')) AS DECIMAL(20,2)))`
      break
    default:
      aggExpr = 'COUNT(*)'
  }

  // Pie chart or grouped data
  if (type === 'pie' || groupBy) {
    const groupColumn = groupBy || xColumn
    return `SELECT 
  COALESCE(
    JSON_UNQUOTE(JSON_EXTRACT(data, '$.${groupColumn}')), 
    'Unknown'
  ) AS group_key,
  ${aggExpr} AS result
FROM synced_data
WHERE database_id = '${databaseId}'
  AND table_name = '${table}'
GROUP BY group_key
ORDER BY result DESC
LIMIT 20;`
  }

  // Time series (date column)
  if (xColumn) {
    const dateKeywords = ['created_at', 'updated_at', 'date', 'timestamp', 'time', 'created', 'modified']
    const isDateCol = dateKeywords.some(kw => xColumn.toLowerCase().includes(kw))

    if (isDateCol) {
      return `SELECT 
  DATE(STR_TO_DATE(
    JSON_UNQUOTE(JSON_EXTRACT(data, '$.${xColumn}')), 
    '%Y-%m-%dT%H:%i:%s'
  )) AS group_key,
  ${aggExpr} AS result
FROM synced_data
WHERE database_id = '${databaseId}'
  AND table_name = '${table}'
  AND JSON_EXTRACT(data, '$.${xColumn}') IS NOT NULL
GROUP BY group_key
ORDER BY group_key ASC
LIMIT 60;`
    }

    // Category grouping
    return `SELECT 
  COALESCE(
    JSON_UNQUOTE(JSON_EXTRACT(data, '$.${xColumn}')), 
    'Unknown'
  ) AS group_key,
  ${aggExpr} AS result
FROM synced_data
WHERE database_id = '${databaseId}'
  AND table_name = '${table}'
GROUP BY group_key
ORDER BY result DESC
LIMIT 20;`
  }

  // Simple aggregation (no grouping)
  return `SELECT 
  ${aggExpr} AS result,
  COUNT(*) AS row_count
FROM synced_data
WHERE database_id = '${databaseId}'
  AND table_name = '${table}';`
}

/**
 * Generate SQL preview for a KPI based on its configuration
 */
function generateKPISQL(kpi: KPIConfig, databaseId: string): string {
  const { table, column, aggregation } = kpi
  
  let aggExpr: string
  switch (aggregation) {
    case 'count':
      aggExpr = 'COUNT(*)'
      break
    case 'sum':
      aggExpr = `SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '$.${column}')) AS DECIMAL(20,2)))`
      break
    case 'avg':
      aggExpr = `AVG(CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '$.${column}')) AS DECIMAL(20,2)))`
      break
    default:
      aggExpr = 'COUNT(*)'
  }

  return `SELECT 
  ${aggExpr} AS result,
  COUNT(*) AS row_count
FROM synced_data
WHERE database_id = '${databaseId}'
  AND table_name = '${table}';`
}

export function AIChartGrid({ databaseId, refreshKey }: AIChartGridProps) {
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [config, setConfig] = useState<DashboardConfig | null>(null)
  const [aiReasoning, setAiReasoning] = useState<string>("")
  const [chartDataMap, setChartDataMap] = useState<Record<string, ChartData>>({})
  const [kpiDataMap, setKpiDataMap] = useState<Record<string, KPIData>>({})
  const [loadedFromCache, setLoadedFromCache] = useState(false)
  const [cacheTime, setCacheTime] = useState<string | null>(null)
  
  // Custom charts state
  const [customCharts, setCustomCharts] = useState<CustomChart[]>([])
  const [deletingChartId, setDeletingChartId] = useState<string | null>(null)
  
  // SQL Preview Dialog state
  const [sqlDialogOpen, setSqlDialogOpen] = useState(false)
  const [sqlDialogTitle, setSqlDialogTitle] = useState("")
  const [sqlDialogContent, setSqlDialogContent] = useState("")
  const [sqlCopied, setSqlCopied] = useState(false)

  // Show SQL for a chart
  const showChartSQL = (chart: ChartConfig) => {
    setSqlDialogTitle(chart.title)
    setSqlDialogContent(generateChartSQL(chart, databaseId))
    setSqlDialogOpen(true)
    setSqlCopied(false)
  }

  // Show SQL for a KPI
  const showKPISQL = (kpi: KPIConfig) => {
    setSqlDialogTitle(kpi.title)
    setSqlDialogContent(generateKPISQL(kpi, databaseId))
    setSqlDialogOpen(true)
    setSqlCopied(false)
  }

  // Copy SQL to clipboard
  const copySQL = async () => {
    try {
      await navigator.clipboard.writeText(sqlDialogContent)
      setSqlCopied(true)
      setTimeout(() => setSqlCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  // Load custom charts
  const loadCustomCharts = useCallback(async () => {
    try {
      const response = await fetch(`/api/ai-dashboard/custom-charts?databaseId=${databaseId}`)
      const result = await response.json()
      if (result.success && result.charts) {
        setCustomCharts(result.charts)
      }
    } catch (err) {
      console.error("Failed to load custom charts:", err)
    }
  }, [databaseId])

  // Delete custom chart
  const deleteCustomChart = async (chartId: string) => {
    setDeletingChartId(chartId)
    try {
      const response = await fetch(
        `/api/ai-dashboard/custom-charts?databaseId=${databaseId}&chartId=${chartId}`,
        { method: "DELETE" }
      )
      const result = await response.json()
      if (result.success) {
        setCustomCharts(prev => prev.filter(c => c.id !== chartId))
      }
    } catch (err) {
      console.error("Failed to delete custom chart:", err)
    } finally {
      setDeletingChartId(null)
    }
  }

  // Load dashboard from cache (INSTANT) or generate with AI
  const loadOrGenerateConfig = useCallback(async (forceRegenerate = false) => {
    setLoading(true)
    setError(null)
    setLoadedFromCache(false)

    try {
      // STEP 1: Try to load from CACHE first (instant loading)
      if (!forceRegenerate) {
        const cacheResponse = await fetch(`/api/ai-dashboard/cache?databaseId=${databaseId}`)
        const cacheResult = await cacheResponse.json()

        if (cacheResult.success && cacheResult.cached) {
          console.log("⚡ Loaded dashboard from cache (instant!)")
          
          // Build config from cached items
          const charts: ChartConfig[] = cacheResult.charts.map((c: { config: ChartConfig }) => c.config)
          const kpis: KPIConfig[] = cacheResult.kpis.map((k: { config: KPIConfig }) => k.config)
          
          setConfig({ charts, kpis })
          setCacheTime(cacheResult.computedAt)
          setLoadedFromCache(true)
          
          // Set chart data from cache
          const chartData: Record<string, ChartData> = {}
          for (const c of cacheResult.charts) {
            chartData[c.id] = { data: c.data, loading: false }
          }
          setChartDataMap(chartData)
          
          // Set KPI data from cache
          const kpiData: Record<string, KPIData> = {}
          for (const k of cacheResult.kpis) {
            kpiData[k.id] = { 
              value: k.data.value, 
              growth: k.data.growth, 
              loading: false 
            }
          }
          setKpiDataMap(kpiData)
          
          // Also try to get AI reasoning from config
          const configResponse = await fetch(`/api/ai-dashboard/config?databaseId=${databaseId}`)
          const configResult = await configResponse.json()
          if (configResult.exists && configResult.aiReasoning) {
            setAiReasoning(configResult.aiReasoning)
          }
          
          setLoading(false)
          return
        }
      }

      // STEP 2: No cache - check if config exists (need to compute data)
      if (!forceRegenerate) {
        const configResponse = await fetch(`/api/ai-dashboard/config?databaseId=${databaseId}`)
        const configResult = await configResponse.json()

        if (configResult.exists && configResult.config) {
          // Config exists but no cache - this is a legacy state
          // We'll regenerate to populate the cache
          console.log("📋 Config exists but no cache. Regenerating to cache data...")
        }
      }

      // STEP 3: Generate with AI (this will also cache the data)
      setGenerating(true)

      // Discover tables
      const discoverResponse = await fetch(`/api/ai-dashboard/discover?databaseId=${databaseId}`)
      const discoverResult = await discoverResponse.json()

      if (!discoverResult.success || discoverResult.tables.length === 0) {
        setError("No synced tables found. Please sync the database first.")
        setLoading(false)
        setGenerating(false)
        return
      }

      // Generate AI configuration (this also caches all data!)
      const generateResponse = await fetch("/api/ai-dashboard/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          databaseId,
          tables: discoverResult.tables,
        }),
      })
      const generateResult = await generateResponse.json()

      if (!generateResult.success) {
        setError(generateResult.error || "Failed to generate dashboard configuration")
        setLoading(false)
        setGenerating(false)
        return
      }

      setConfig(generateResult.config)
      setAiReasoning(generateResult.config.reasoning || "")
      setGenerating(false)
      
      // After generation, load from cache (data is now cached)
      const cacheResponse = await fetch(`/api/ai-dashboard/cache?databaseId=${databaseId}`)
      const cacheResult = await cacheResponse.json()
      
      if (cacheResult.success && cacheResult.cached) {
        // Set chart data from cache
        const chartData: Record<string, ChartData> = {}
        for (const c of cacheResult.charts) {
          chartData[c.id] = { data: c.data, loading: false }
        }
        setChartDataMap(chartData)
        
        // Set KPI data from cache
        const kpiData: Record<string, KPIData> = {}
        for (const k of cacheResult.kpis) {
          kpiData[k.id] = { 
            value: k.data.value, 
            growth: k.data.growth, 
            loading: false 
          }
        }
        setKpiDataMap(kpiData)
        
        setCacheTime(cacheResult.computedAt)
        setLoadedFromCache(true)
      }
      
      setLoading(false)
    } catch (err) {
      console.error("Error loading/generating config:", err)
      setError(err instanceof Error ? err.message : "Unknown error")
      setLoading(false)
      setGenerating(false)
    }
  }, [databaseId])

  // Initial load
  useEffect(() => {
    loadOrGenerateConfig()
    loadCustomCharts()
  }, [loadOrGenerateConfig, loadCustomCharts])

  // Reload custom charts when refreshKey changes
  useEffect(() => {
    if (refreshKey !== undefined && refreshKey > 0) {
      loadCustomCharts()
    }
  }, [refreshKey, loadCustomCharts])

  // Handle regenerate
  const handleRegenerate = async () => {
    // Delete existing config and cache
    await fetch(`/api/ai-dashboard/config?databaseId=${databaseId}`, {
      method: "DELETE",
    })
    await fetch(`/api/ai-dashboard/cache?databaseId=${databaseId}`, {
      method: "DELETE",
    })
    // Regenerate
    loadOrGenerateConfig(true)
  }

  // Format value based on type
  const formatValue = (value: number, title: string) => {
    const lowerTitle = title.toLowerCase()
    if (lowerTitle.includes("revenue") || lowerTitle.includes("amount") || lowerTitle.includes("balance")) {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value)
    }
    if (lowerTitle.includes("rate") || lowerTitle.includes("percent")) {
      return `${value.toFixed(1)}%`
    }
    return value.toLocaleString()
  }

  // Render loading state
  if (loading || generating) {
    return (
      <div className="space-y-6">
        {generating && (
          <div className="flex items-center gap-2 p-4 bg-primary/10 rounded-lg">
            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
            <span className="text-sm">AI is analyzing your data and generating the optimal dashboard... This may take a moment.</span>
          </div>
        )}
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

  // Render error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <p className="text-destructive">{error}</p>
        <Button onClick={() => loadOrGenerateConfig()} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Sparkles className="w-12 h-12 text-muted-foreground" />
        <p className="text-muted-foreground">No dashboard configuration found</p>
        <Button onClick={() => loadOrGenerateConfig(true)}>
          <Sparkles className="w-4 h-4 mr-2" />
          Generate with AI
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* AI Reasoning & Regenerate Button */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          {loadedFromCache && (
            <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
              <Zap className="w-3 h-3" />
              Loaded instantly from cache
              {cacheTime && (
                <span className="text-muted-foreground">
                  (computed {new Date(cacheTime).toLocaleString()})
                </span>
              )}
            </div>
          )}
          {aiReasoning && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Sparkles className="w-3 h-3" />
                AI Analysis
              </div>
              <p className="text-sm">{aiReasoning}</p>
            </div>
          )}
        </div>
        <Button onClick={handleRegenerate} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Regenerate
        </Button>
      </div>

      {/* KPI Cards */}
      {config.kpis && config.kpis.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {config.kpis.map((kpi) => {
            const data = kpiDataMap[kpi.id]
            const IconComponent = ICON_MAP[kpi.icon] || Activity

            return (
              <Card key={kpi.id}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => showKPISQL(kpi)}
                      title="View SQL Query"
                    >
                      <Code className="w-3 h-3 text-muted-foreground" />
                    </Button>
                    <IconComponent className="w-4 h-4 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  {!data || data.loading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : data.error ? (
                    <p className="text-sm text-destructive">{data.error}</p>
                  ) : (
                    <>
                      <div className="font-bold text-2xl">
                        {formatValue(data.value ?? 0, kpi.title)}
                      </div>
                      {data.growth !== undefined && data.growth !== 0 && (
                        <p className="text-xs text-muted-foreground">
                          <span className={data.growth >= 0 ? "text-green-600" : "text-red-600"}>
                            {data.growth >= 0 ? "+" : ""}{data.growth.toFixed(1)}%
                          </span>{" "}
                          from last period
                        </p>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* AI Charts */}
      {config.charts && config.charts.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          {config.charts.map((chart, chartIndex) => {
            const data = chartDataMap[chart.id]
            const chartColor = COLORS[chartIndex % COLORS.length]

            return (
              <Card key={chart.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{chart.title}</CardTitle>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => showChartSQL(chart)}
                        title="View SQL Query"
                      >
                        <Code className="w-4 h-4 text-muted-foreground" />
                      </Button>
                      {chart.type === "line" && <LineChartIcon className="w-5 h-5 text-muted-foreground" />}
                      {chart.type === "bar" && <BarChart3 className="w-5 h-5 text-muted-foreground" />}
                      {chart.type === "pie" && <PieChartIcon className="w-5 h-5 text-muted-foreground" />}
                      {chart.type === "area" && <TrendingUp className="w-5 h-5 text-muted-foreground" />}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Source: {chart.table} • {chart.aggregation}({chart.columns?.y || 'value'})
                  </p>
                </CardHeader>
                <CardContent>
                  {!data || data.loading ? (
                    <Skeleton className="h-64 w-full" />
                  ) : data.error ? (
                    <div className="flex items-center justify-center h-64">
                      <p className="text-sm text-destructive">{data.error}</p>
                    </div>
                  ) : !data.data || data.data.length === 0 ? (
                    <div className="flex items-center justify-center h-64">
                      <p className="text-sm text-muted-foreground">No data available</p>
                    </div>
                  ) : (
                    <ChartContainer 
                      config={{ value: { label: chart.columns?.y || 'value', color: chartColor } }} 
                      className="h-64"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        {renderChart(chart, data.data, chartIndex)}
                      </ResponsiveContainer>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Custom Charts Section */}
      {customCharts.length > 0 && (
        <>
          <div className="flex items-center gap-2 pt-4">
            <div className="h-px flex-1 bg-border" />
            <span className="text-sm text-muted-foreground px-2">Custom Charts</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {customCharts.map((customChart, chartIndex) => {
              const chartColor = COLORS[(config?.charts?.length || 0 + chartIndex) % COLORS.length]
              const chartType = customChart.config.chartType as "line" | "bar" | "pie" | "area"
              
              return (
                <Card key={customChart.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{customChart.config.title}</CardTitle>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => deleteCustomChart(customChart.id)}
                          title="Delete Chart"
                          disabled={deletingChartId === customChart.id}
                        >
                          {deletingChartId === customChart.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                        {chartType === "line" && <LineChartIcon className="w-5 h-5 text-muted-foreground" />}
                        {chartType === "bar" && <BarChart3 className="w-5 h-5 text-muted-foreground" />}
                        {chartType === "pie" && <PieChartIcon className="w-5 h-5 text-muted-foreground" />}
                        {chartType === "area" && <TrendingUp className="w-5 h-5 text-muted-foreground" />}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Source: {customChart.config.dataSource.table} • {customChart.config.aggregation}({customChart.config.dataSource.yAxis[0] || 'value'})
                    </p>
                  </CardHeader>
                  <CardContent>
                    {!customChart.data || customChart.data.length === 0 ? (
                      <div className="flex items-center justify-center h-64">
                        <p className="text-sm text-muted-foreground">No data available</p>
                      </div>
                    ) : (
                      <ChartContainer 
                        config={{ value: { label: customChart.config.dataSource.yAxis[0] || 'value', color: chartColor } }} 
                        className="h-64"
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          {renderCustomChart(customChart, chartIndex + (config?.charts?.length || 0))}
                        </ResponsiveContainer>
                      </ChartContainer>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}

      {/* SQL Preview Dialog */}
      <Dialog open={sqlDialogOpen} onOpenChange={setSqlDialogOpen}>
        <DialogContent className="max-w-2xl w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">SQL Query - {sqlDialogTitle}</span>
            </DialogTitle>
            <DialogDescription>
              This is the MySQL query used to generate the data for this chart/KPI.
            </DialogDescription>
          </DialogHeader>
          <div className="relative min-w-0">
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs font-mono whitespace-pre-wrap break-words max-w-full">
              {sqlDialogContent}
            </pre>
            <Button
              variant="outline"
              size="sm"
              className="absolute top-2 right-2 h-7 px-2 text-xs"
              onClick={copySQL}
            >
              {sqlCopied ? (
                <>
                  <Check className="w-3 h-3 mr-1 text-green-600" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Note: This SQL runs against the synced_data table which stores your external data in JSON format.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function renderChart(chart: ChartConfig, rawData: unknown, chartIndex: number = 0) {
  // Ensure data is always an array
  const data: Record<string, unknown>[] = Array.isArray(rawData) ? rawData : []
  
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">No data available</p>
      </div>
    )
  }
  
  const dataKey = 'value' in data[0] ? 'value' : 
    Object.keys(data[0]).find(k => k !== 'date' && k !== 'name' && k !== 'category') || 'value'
  
  const xKey = 'date' in data[0] ? 'date' : 
    'name' in data[0] ? 'name' :
    'category' in data[0] ? 'category' :
    Object.keys(data[0])[0]

  // Each chart gets its own color based on its index
  const chartColor = COLORS[chartIndex % COLORS.length]

  switch (chart.type) {
    case "line":
      return (
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey={xKey} className="text-xs" />
          <YAxis className="text-xs" />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Line 
            type="monotone" 
            dataKey={dataKey} 
            stroke={chartColor} 
            strokeWidth={2}
            dot={{ fill: chartColor, strokeWidth: 2 }}
          />
        </LineChart>
      )

    case "bar":
      return (
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey={xKey} className="text-xs" />
          <YAxis className="text-xs" />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey={dataKey} fill={chartColor} radius={[4, 4, 0, 0]} />
        </BarChart>
      )

    case "area":
      return (
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey={xKey} className="text-xs" />
          <YAxis className="text-xs" />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Area 
            type="monotone" 
            dataKey={dataKey} 
            stroke={chartColor} 
            fill={chartColor} 
            fillOpacity={0.3}
          />
        </AreaChart>
      )

    case "pie":
      return (
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
            outerRadius={80}
            fill={chartColor}
            dataKey={dataKey}
            nameKey={xKey}
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <ChartTooltip content={<ChartTooltipContent />} />
          <Legend />
        </PieChart>
      )

    default:
      return (
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey={xKey} className="text-xs" />
          <YAxis className="text-xs" />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey={dataKey} fill={chartColor} radius={[4, 4, 0, 0]} />
        </BarChart>
      )
  }
}

function renderCustomChart(customChart: CustomChart, chartIndex: number = 0) {
  const data = customChart.data
  const { chartType, dataSource } = customChart.config
  const xKey = dataSource.xAxis
  const yKey = dataSource.yAxis[0]
  const chartColor = COLORS[chartIndex % COLORS.length]

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">No data available</p>
      </div>
    )
  }

  switch (chartType) {
    case "line":
      return (
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey={xKey} className="text-xs" />
          <YAxis className="text-xs" />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Line 
            type="monotone" 
            dataKey={yKey} 
            stroke={chartColor} 
            strokeWidth={2}
            dot={{ fill: chartColor, strokeWidth: 2 }}
          />
        </LineChart>
      )

    case "bar":
      return (
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey={xKey} className="text-xs" />
          <YAxis className="text-xs" />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey={yKey} fill={chartColor} radius={[4, 4, 0, 0]} />
        </BarChart>
      )

    case "area":
      return (
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey={xKey} className="text-xs" />
          <YAxis className="text-xs" />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Area 
            type="monotone" 
            dataKey={yKey} 
            stroke={chartColor} 
            fill={chartColor} 
            fillOpacity={0.3}
          />
        </AreaChart>
      )

    case "pie":
      return (
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name || ''} (${(percent * 100).toFixed(0)}%)`}
            outerRadius={80}
            fill={chartColor}
            dataKey={yKey}
            nameKey={xKey}
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <ChartTooltip content={<ChartTooltipContent />} />
          <Legend />
        </PieChart>
      )

    default:
      return (
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey={xKey} className="text-xs" />
          <YAxis className="text-xs" />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey={yKey} fill={chartColor} radius={[4, 4, 0, 0]} />
        </BarChart>
      )
  }
}
