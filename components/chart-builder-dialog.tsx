"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Loader2 } from "lucide-react"
import { ChartTypeSelector } from "./chart-type-selector"
import { DataSourceSelector } from "./data-source-selector"
import { ChartFilterBuilder } from "./chart-filter-builder"
import { ChartPreview } from "./chart-preview"

interface ChartBuilderDialogProps {
  databaseId: string | null
  onSave?: (config: ChartConfig) => void
  isSaving?: boolean
}

interface ChartConfig {
  title: string
  chartType: string
  dataSource: {
    table: string
    xAxis: string
    yAxis: string[]
  }
  filters: Array<{
    field: string
    operator: string
    value: string
  }>
  aggregation: string
  groupBy: string
}

export function ChartBuilderDialog({ databaseId, onSave, isSaving }: ChartBuilderDialogProps) {
  const [open, setOpen] = useState(false)
  const [config, setConfig] = useState<ChartConfig>({
    title: "New Chart",
    chartType: "line",
    dataSource: {
      table: "",
      xAxis: "",
      yAxis: [],
    },
    filters: [],
    aggregation: "sum",
    groupBy: "",
  })

  const handleSave = () => {
    onSave?.(config)
    // Dialog will close after successful save via parent callback
    setOpen(false)
  }

  const canSave = config.title && config.dataSource.table && config.dataSource.xAxis && config.dataSource.yAxis.length > 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Chart
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Custom Chart</DialogTitle>
          <DialogDescription>Design your chart with custom data sources, filters, and visualizations</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="type" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="type">Chart Type</TabsTrigger>
            <TabsTrigger value="data">Data Source</TabsTrigger>
            <TabsTrigger value="filters">Filters</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="type" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Chart Title</Label>
              <Input
                id="title"
                value={config.title}
                onChange={(e) => setConfig({ ...config, title: e.target.value })}
                placeholder="Enter chart title"
              />
            </div>

            <div className="space-y-2">
              <Label>Select Chart Type</Label>
              <ChartTypeSelector
                value={config.chartType}
                onChange={(type) => setConfig({ ...config, chartType: type })}
              />
            </div>
          </TabsContent>

          <TabsContent value="data" className="space-y-4">
            <DataSourceSelector
              databaseId={databaseId}
              value={config.dataSource}
              onChange={(dataSource) => setConfig({ ...config, dataSource })}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="aggregation">Aggregation</Label>
                <Select
                  value={config.aggregation}
                  onValueChange={(value) => setConfig({ ...config, aggregation: value })}
                >
                  <SelectTrigger id="aggregation">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sum">Sum</SelectItem>
                    <SelectItem value="avg">Average</SelectItem>
                    <SelectItem value="count">Count</SelectItem>
                    <SelectItem value="min">Minimum</SelectItem>
                    <SelectItem value="max">Maximum</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="groupBy">Group By</Label>
                <Input
                  id="groupBy"
                  value={config.groupBy}
                  onChange={(e) => setConfig({ ...config, groupBy: e.target.value })}
                  placeholder="Field name"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="filters" className="space-y-4">
            <ChartFilterBuilder
              filters={config.filters}
              onChange={(filters) => setConfig({ ...config, filters })}
              databaseId={databaseId}
            />
          </TabsContent>

          <TabsContent value="preview" className="space-y-4">
            <ChartPreview config={config} databaseId={databaseId} />
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave || isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Chart"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
