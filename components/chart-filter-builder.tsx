"use client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2 } from "lucide-react"

interface Filter {
  field: string
  operator: string
  value: string
}

interface ChartFilterBuilderProps {
  filters: Filter[]
  onChange: (filters: Filter[]) => void
  databaseId: string | null
}

const operators = [
  { value: "eq", label: "Equals" },
  { value: "neq", label: "Not Equals" },
  { value: "gt", label: "Greater Than" },
  { value: "lt", label: "Less Than" },
  { value: "gte", label: "Greater or Equal" },
  { value: "lte", label: "Less or Equal" },
  { value: "contains", label: "Contains" },
  { value: "startsWith", label: "Starts With" },
]

export function ChartFilterBuilder({ filters, onChange, databaseId }: ChartFilterBuilderProps) {
  const addFilter = () => {
    onChange([...filters, { field: "", operator: "eq", value: "" }])
  }

  const removeFilter = (index: number) => {
    onChange(filters.filter((_, i) => i !== index))
  }

  const updateFilter = (index: number, updates: Partial<Filter>) => {
    const newFilters = [...filters]
    newFilters[index] = { ...newFilters[index], ...updates }
    onChange(newFilters)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">Data Filters</h3>
        <Button type="button" variant="outline" size="sm" onClick={addFilter}>
          <Plus className="w-4 h-4 mr-2" />
          Add Filter
        </Button>
      </div>

      {filters.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No filters applied. Click "Add Filter" to create one.
        </div>
      ) : (
        <div className="space-y-3">
          {filters.map((filter, index) => (
            <div key={index} className="flex gap-2 items-start p-3 border rounded-lg">
              <div className="flex-1 space-y-2">
                <Input
                  placeholder="Field name"
                  value={filter.field}
                  onChange={(e) => updateFilter(index, { field: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Select value={filter.operator} onValueChange={(operator) => updateFilter(index, { operator })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {operators.map((op) => (
                        <SelectItem key={op.value} value={op.value}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Value"
                    value={filter.value}
                    onChange={(e) => updateFilter(index, { value: e.target.value })}
                  />
                </div>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => removeFilter(index)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
