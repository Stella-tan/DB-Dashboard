-- AI Dashboard Cache Schema
-- Run this in MySQL Workbench on schema: dashboard_vibe2
-- Database: localhost:3306, Username: root, Password: 1234qwer
--
-- This script creates a cache table for pre-computed chart/KPI data
-- Dashboard loads will be instant by reading from this cache instead of synced_data

USE dashboard_vibe2;

-- ============================================================================
-- AI Dashboard Cache Table
-- Stores pre-computed chart and KPI data for instant dashboard loading
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_dashboard_cache (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  database_id CHAR(36) NOT NULL,
  item_id VARCHAR(100) NOT NULL,           -- Chart or KPI ID (e.g., "chart_1", "kpi_total_users")
  item_type ENUM('chart', 'kpi') NOT NULL,
  config JSON NOT NULL,                     -- Chart/KPI configuration (title, type, columns, aggregation, etc.)
  computed_data JSON NOT NULL,              -- Pre-computed data points
  computed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Each database can only have one cached version of each chart/KPI
  UNIQUE KEY unique_db_item (database_id, item_id),
  
  -- Foreign key to external_databases
  FOREIGN KEY (database_id) REFERENCES external_databases(id) ON DELETE CASCADE
);

-- Index for fast lookups by database_id
CREATE INDEX idx_ai_dashboard_cache_database_id ON ai_dashboard_cache(database_id);

-- Index for checking cache freshness
CREATE INDEX idx_ai_dashboard_cache_computed_at ON ai_dashboard_cache(database_id, computed_at);

-- ============================================================================
-- Verification
-- ============================================================================

SELECT 'ai_dashboard_cache table created successfully!' as status;

DESCRIBE ai_dashboard_cache;

