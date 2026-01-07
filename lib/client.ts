/**
 * Browser-side database client
 * Uses API routes since browser can't connect directly to MySQL
 * 
 * NOTE: This file is imported by client components, so we cannot
 * import any server-side MySQL code here.
 */
export function getSupabaseBrowserClient() {
  // Return a client that uses API routes
  return {
    from: (tableName: string) => {
      let currentColumns: string | string[] = "*"
      let currentFilters: Array<{ column: string; operator: string; value: any }> = []
      let currentLimit: number | undefined = undefined
      let currentOffset: number | undefined = undefined
      let currentOrderBy: { column: string; ascending: boolean } | undefined = undefined
      let countMode = false
      
      const queryBuilder = {
        select: (columns?: string | string[], options?: { count?: string; head?: boolean }) => {
          if (options?.count || options?.head) {
            countMode = true
            currentColumns = "*"
          } else {
            currentColumns = columns || "*"
            countMode = false
          }
          return queryBuilder
        },
        eq: (column: string, value: any) => {
          currentFilters.push({ column, operator: "eq", value })
          return queryBuilder
        },
        neq: (column: string, value: any) => {
          currentFilters.push({ column, operator: "neq", value })
          return queryBuilder
        },
        gt: (column: string, value: any) => {
          currentFilters.push({ column, operator: "gt", value })
          return queryBuilder
        },
        gte: (column: string, value: any) => {
          currentFilters.push({ column, operator: "gte", value })
          return queryBuilder
        },
        lt: (column: string, value: any) => {
          currentFilters.push({ column, operator: "lt", value })
          return queryBuilder
        },
        lte: (column: string, value: any) => {
          currentFilters.push({ column, operator: "lte", value })
          return queryBuilder
        },
        like: (column: string, value: string) => {
          currentFilters.push({ column, operator: "like", value })
          return queryBuilder
        },
        ilike: (column: string, value: string) => {
          currentFilters.push({ column, operator: "ilike", value: `%${value}%` })
          return queryBuilder
        },
        order: (column: string, options?: { ascending?: boolean }) => {
          currentOrderBy = { column, ascending: options?.ascending !== false }
          return queryBuilder
        },
        limit: (count: number) => {
          currentLimit = count
          return queryBuilder
        },
        range: (from: number, to: number) => {
          currentOffset = from
          currentLimit = to - from + 1
          return queryBuilder
        },
        insert: async (data: Record<string, any> | Record<string, any>[]) => {
          const response = await fetch(`/api/mysql/query`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              table: tableName,
              operation: "insert",
              data
            }),
          })
          return response.json()
        },
        delete: () => {
          // Return a new builder for delete operation with chained eq() calls
          const deleteBuilder = {
            eq: (column: string, value: any) => {
              currentFilters.push({ column, operator: "eq", value })
              return deleteBuilder
            },
            then: async (resolve: (result: any) => void, reject?: (error: any) => void) => {
              try {
                const response = await fetch(`/api/mysql/query`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ 
                    table: tableName,
                    operation: "delete",
                    filters: currentFilters
                  }),
                })
                const result = await response.json()
                resolve(result)
              } catch (error) {
                if (reject) reject(error)
                else resolve({ error })
              }
            }
          }
          return deleteBuilder
        },
        single: async () => {
          const response = await fetch(`/api/mysql/query`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              table: tableName, 
              columns: Array.isArray(currentColumns) ? currentColumns.join(",") : currentColumns,
              filters: currentFilters,
              orderBy: currentOrderBy,
              limit: 1
            }),
          })
          const result = await response.json()
          if (result.error) return result
          return {
            data: result.data && result.data.length > 0 ? result.data[0] : null,
            error: null,
          }
        },
        executeQuery: async () => {
          const response = await fetch(`/api/mysql/query`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              table: tableName, 
              columns: Array.isArray(currentColumns) ? currentColumns.join(",") : currentColumns,
              filters: currentFilters,
              orderBy: currentOrderBy,
              limit: currentLimit,
              offset: currentOffset
            }),
          })
          return response.json()
        },
        then: async (callback: (result: any) => any) => {
          const response = await fetch(`/api/mysql/query`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              table: tableName, 
              columns: Array.isArray(currentColumns) ? currentColumns.join(",") : currentColumns,
              filters: currentFilters,
              orderBy: currentOrderBy,
              limit: currentLimit,
              offset: currentOffset
            }),
          })
          const result = await response.json()
          return callback(result)
        },
      }
      return queryBuilder
    },
  }
}
