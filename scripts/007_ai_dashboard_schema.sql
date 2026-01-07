-- AI Dashboard Configuration Schema
-- Run this in MySQL Workbench on schema: dashboard_vibe2
-- This stores AI-generated dashboard configurations for each external database

USE dashboard_vibe2;

-- AI Dashboard Configurations - stores the AI-generated chart configurations per database
CREATE TABLE IF NOT EXISTS ai_dashboard_configs (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  database_id CHAR(36) NOT NULL UNIQUE,  -- One config per external database
  config JSON NOT NULL,  -- Stores the complete dashboard configuration
  ai_model VARCHAR(255) DEFAULT 'openai/gpt-4o-mini',  -- Which AI model generated this
  ai_reasoning TEXT NULL,  -- AI's explanation of why these charts were chosen
  generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (database_id) REFERENCES external_databases(id) ON DELETE CASCADE
);

-- The config JSON structure will be:
-- {
--   "charts": [
--     {
--       "id": "uuid",
--       "title": "Daily Active Users",
--       "type": "line" | "bar" | "pie" | "area" | "scatter" | "table" | "stat",
--       "table": "user",
--       "columns": {
--         "x": "created_at",        -- X-axis or category
--         "y": "id",                -- Y-axis or value (will be aggregated)
--         "groupBy": "status",      -- Optional: group by column
--         "filter": {...}           -- Optional: filter conditions
--       },
--       "aggregation": "count" | "sum" | "avg" | "min" | "max",
--       "dateRange": "7d" | "14d" | "30d" | "90d" | "all",
--       "position": { "x": 0, "y": 0 },
--       "size": { "width": 1, "height": 1 }  -- Grid units
--     }
--   ],
--   "kpis": [
--     {
--       "id": "uuid",
--       "title": "Total Users",
--       "table": "user",
--       "column": "id",
--       "aggregation": "count",
--       "filter": {...},
--       "icon": "users",
--       "compareWith": "previous_period"  -- For growth calculation
--     }
--   ]
-- }

-- Create index for faster lookups
CREATE INDEX idx_ai_dashboard_configs_database_id ON ai_dashboard_configs(database_id);

