import { useState, useEffect } from "react"

interface UseSyncedDataOptions {
  databaseId: string | null
  tableName: string | null
  filters?: Array<{
    column: string
    operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "ilike"
    value: any
  }>
  limit?: number
  offset?: number
  columns?: string[]
}

export function useSyncedData(options: UseSyncedDataOptions) {
  const { databaseId, tableName, filters, limit, offset, columns } = options
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [count, setCount] = useState(0)

  useEffect(() => {
    console.log("[useSyncedData] Called with:", { databaseId, tableName })
    
    if (!databaseId || !tableName) {
      console.log("[useSyncedData] Skipping fetch - missing databaseId or tableName")
      setData([])
      setLoading(false)
      return
    }

    const fetchData = async () => {
      setLoading(true)
      setError(null)

      const requestBody = {
        databaseId,
        tableName,
        filters,
        limit,
        offset,
        columns,
      }
      console.log("[useSyncedData] Fetching with:", requestBody)

      try {
        const response = await fetch("/api/data/query", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to fetch data")
        }

        const result = await response.json()
        setData(result.data || [])
        setCount(result.count || 0)
      } catch (err: any) {
        setError(err.message)
        setData([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [databaseId, tableName, JSON.stringify(filters), limit, offset, JSON.stringify(columns)])

  return { data, loading, error, count }
}


