"use client"

import { BarChart3, LineChart, PieChart, ScatterChart, Table, AreaChart } from "lucide-react"
import { cn } from "@/lib/utils"

interface ChartTypeSelectorProps {
  value: string
  onChange: (type: string) => void
}

const chartTypes = [
  { value: "line", label: "Line Chart", icon: LineChart, description: "Show trends over time" },
  { value: "bar", label: "Bar Chart", icon: BarChart3, description: "Compare categories" },
  { value: "area", label: "Area Chart", icon: AreaChart, description: "Display cumulative data" },
  { value: "pie", label: "Pie Chart", icon: PieChart, description: "Show proportions" },
  { value: "scatter", label: "Scatter Plot", icon: ScatterChart, description: "Plot correlations" },
  { value: "table", label: "Data Table", icon: Table, description: "Display raw data" },
]

export function ChartTypeSelector({ value, onChange }: ChartTypeSelectorProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {chartTypes.map((type) => {
        const Icon = type.icon
        return (
          <button
            key={type.value}
            onClick={() => onChange(type.value)}
            className={cn(
              "flex flex-col items-start gap-2 rounded-lg border-2 p-4 transition-all hover:border-primary/50",
              value === type.value ? "border-primary bg-primary/5" : "border-border",
            )}
          >
            <Icon className={cn("w-8 h-8", value === type.value ? "text-primary" : "text-muted-foreground")} />
            <div className="text-left">
              <div className="font-medium text-sm">{type.label}</div>
              <div className="text-xs text-muted-foreground">{type.description}</div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
