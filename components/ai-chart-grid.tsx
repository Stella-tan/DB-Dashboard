"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  Users, DollarSign, Package, Activity, TrendingUp, Wallet, 
  CheckCircle, Clock, RefreshCw, Sparkles, AlertCircle,
  BarChart3, LineChartIcon, PieChart as PieChartIcon
} from "lucide-react"
import { 
  Line, LineChart, Bar, BarChart, Pie, PieChart,
  Area, AreaChart, CartesianGrid, XAxis, YAxis, 
  ResponsiveContainer, Cell, Legend
} from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

interface AIChartGridProps {
  databaseId: string
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

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "#8884d8",
  "#82ca9d",
  "#ffc658",
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

export function AIChartGrid({ databaseId }: AIChartGridProps) {
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [config, setConfig] = useState<DashboardConfig | null>(null)
  const [aiReasoning, setAiReasoning] = useState<string>("")
  const [chartDataMap, setChartDataMap] = useState<Record<string, ChartData>>({})
  const [kpiDataMap, setKpiDataMap] = useState<Record<string, KPIData>>({})

  // Load or generate dashboard configuration
  const loadOrGenerateConfig = useCallback(async (forceRegenerate = false) => {
    setLoading(true)
    setError(null)

    try {
      // First, check if there's an existing config
      if (!forceRegenerate) {
        const configResponse = await fetch(`/api/ai-dashboard/config?databaseId=${databaseId}`)
        const configResult = await configResponse.json()

        if (configResult.exists && configResult.config) {
          setConfig(configResult.config)
          setAiReasoning(configResult.aiReasoning || "")
          setLoading(false)
          return
        }
      }

      // No existing config or force regenerate - generate with AI
      setGenerating(true)

      // Step 1: Discover tables and sample data
      const discoverResponse = await fetch(`/api/ai-dashboard/discover?databaseId=${databaseId}`)
      const discoverResult = await discoverResponse.json()

      if (!discoverResult.success || discoverResult.tables.length === 0) {
        setError("No synced tables found. Please sync the database first.")
        setLoading(false)
        setGenerating(false)
        return
      }

      // Step 2: Generate AI configuration
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
      setLoading(false)
    } catch (err) {
      console.error("Error loading/generating config:", err)
      setError(err instanceof Error ? err.message : "Unknown error")
      setLoading(false)
      setGenerating(false)
    }
  }, [databaseId])

  // Load chart data for each chart in config
  const loadChartData = useCallback(async (charts: ChartConfig[]) => {
    const newChartData: Record<string, ChartData> = {}

    for (const chart of charts) {
      newChartData[chart.id] = { data: [], loading: true }
    }
    setChartDataMap(newChartData)

    // Load data for each chart
    for (const chart of charts) {
      try {
        const response = await fetch("/api/ai-dashboard/chart-data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ databaseId, chart }),
        })
        const result = await response.json()

        setChartDataMap(prev => ({
          ...prev,
          [chart.id]: {
            data: result.data || [],
            loading: false,
            error: result.error,
          },
        }))
      } catch (err) {
        setChartDataMap(prev => ({
          ...prev,
          [chart.id]: {
            data: [],
            loading: false,
            error: err instanceof Error ? err.message : "Failed to load data",
          },
        }))
      }
    }
  }, [databaseId])

  // Load KPI data for each KPI in config
  const loadKPIData = useCallback(async (kpis: KPIConfig[]) => {
    const newKpiData: Record<string, KPIData> = {}

    for (const kpi of kpis) {
      newKpiData[kpi.id] = { value: 0, growth: 0, loading: true }
    }
    setKpiDataMap(newKpiData)

    // Load data for each KPI
    for (const kpi of kpis) {
      try {
        const response = await fetch("/api/ai-dashboard/kpi-data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ databaseId, kpi }),
        })
        const result = await response.json()

        setKpiDataMap(prev => ({
          ...prev,
          [kpi.id]: {
            value: result.value || 0,
            growth: result.growth || 0,
            loading: false,
            error: result.error,
          },
        }))
      } catch (err) {
        setKpiDataMap(prev => ({
          ...prev,
          [kpi.id]: {
            value: 0,
            growth: 0,
            loading: false,
            error: err instanceof Error ? err.message : "Failed to load data",
          },
        }))
      }
    }
  }, [databaseId])

  // Initial load
  useEffect(() => {
    loadOrGenerateConfig()
  }, [loadOrGenerateConfig])

  // Load data when config changes
  useEffect(() => {
    if (config) {
      if (config.charts && config.charts.length > 0) {
        loadChartData(config.charts)
      }
      if (config.kpis && config.kpis.length > 0) {
        loadKPIData(config.kpis)
      }
    }
  }, [config, loadChartData, loadKPIData])

  // Handle regenerate
  const handleRegenerate = async () => {
    // Delete existing config
    await fetch(`/api/ai-dashboard/config?databaseId=${databaseId}`, {
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
            <span className="text-sm">AI is analyzing your data and generating the optimal dashboard...</span>
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
        {aiReasoning && (
          <div className="flex-1 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Sparkles className="w-3 h-3" />
              AI Analysis
            </div>
            <p className="text-sm">{aiReasoning}</p>
          </div>
        )}
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
                  <IconComponent className="w-4 h-4 text-muted-foreground" />
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

      {/* Charts */}
      {config.charts && config.charts.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          {config.charts.map((chart) => {
            const data = chartDataMap[chart.id]

            return (
              <Card key={chart.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{chart.title}</CardTitle>
                    {chart.type === "line" && <LineChartIcon className="w-5 h-5 text-muted-foreground" />}
                    {chart.type === "bar" && <BarChart3 className="w-5 h-5 text-muted-foreground" />}
                    {chart.type === "pie" && <PieChartIcon className="w-5 h-5 text-muted-foreground" />}
                    {chart.type === "area" && <TrendingUp className="w-5 h-5 text-muted-foreground" />}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Source: {chart.table} • {chart.aggregation}({chart.columns.y})
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
                      config={{ value: { label: chart.columns.y, color: COLORS[0] } }} 
                      className="h-64"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        {renderChart(chart, data.data)}
                      </ResponsiveContainer>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function renderChart(chart: ChartConfig, data: Record<string, unknown>[]) {
  const dataKey = data.length > 0 ? (
    'value' in data[0] ? 'value' : 
    Object.keys(data[0]).find(k => k !== 'date' && k !== 'name' && k !== 'category') || 'value'
  ) : 'value'
  
  const xKey = data.length > 0 ? (
    'date' in data[0] ? 'date' : 
    'name' in data[0] ? 'name' :
    'category' in data[0] ? 'category' :
    Object.keys(data[0])[0]
  ) : 'date'

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
            stroke={COLORS[0]} 
            strokeWidth={2}
            dot={{ fill: COLORS[0], strokeWidth: 2 }}
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
          <Bar dataKey={dataKey} fill={COLORS[0]} radius={[4, 4, 0, 0]} />
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
            stroke={COLORS[0]} 
            fill={COLORS[0]} 
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
            fill="#8884d8"
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
          <Bar dataKey={dataKey} fill={COLORS[0]} radius={[4, 4, 0, 0]} />
        </BarChart>
      )
  }
}

