export interface Team {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  email: string
  name: string
  created_at: string
}

export interface TeamMember {
  id: string
  team_id: string
  user_id: string
  role: "admin" | "member" | "viewer"
  created_at: string
}

export interface ExternalDatabase {
  id: string
  name: string
  description: string | null
  connection_string: string
  database_type: "postgres" | "mysql" | "mongodb"
  sync_status: "pending" | "syncing" | "active" | "error"
  last_synced_at: string | null
  sync_schedule?: "manual" | "hourly" | "daily" | "weekly" | null
  sync_enabled?: boolean | null
  created_at: string
  updated_at: string
}

export interface SyncedTable {
  id: string
  database_id: string
  table_name: string
  schema_definition: Record<string, unknown>
  row_count: number
  last_synced_at: string | null
  last_data_synced_at?: string | null
  created_at: string
}

export interface Chatbot {
  id: string
  name: string
  description: string | null
  system_prompt: string
  model: string
  temperature: number
  created_at: string
  updated_at: string
}

export interface DashboardConfig {
  id: string
  user_id: string
  team_id: string
  name: string
  is_default: boolean
  layout: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface ChartConfig {
  id: string
  dashboard_id: string
  database_id: string | null
  chart_type: "line" | "bar" | "pie" | "area" | "scatter" | "table"
  title: string
  data_source: Record<string, unknown>
  filters: unknown[]
  position: { x: number; y: number }
  size: { width: number; height: number }
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: string
  chatbot_id: string
  user_id: string
  role: "user" | "assistant" | "system"
  content: string
  metadata: Record<string, unknown>
  created_at: string
}
