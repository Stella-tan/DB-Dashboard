-- Sync jobs - track synchronization tasks
CREATE TABLE IF NOT EXISTS sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  database_id UUID REFERENCES external_databases(id) ON DELETE CASCADE,
  table_name TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'error')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  rows_synced INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add sync schedule to external_databases (manual sync only)
ALTER TABLE external_databases 
ADD COLUMN IF NOT EXISTS sync_schedule TEXT DEFAULT 'manual' CHECK (sync_schedule IN ('manual', 'hourly', 'daily', 'weekly')),
ADD COLUMN IF NOT EXISTS sync_enabled BOOLEAN DEFAULT true;

-- Add last data sync time to synced_tables
ALTER TABLE synced_tables 
ADD COLUMN IF NOT EXISTS last_data_synced_at TIMESTAMPTZ;

-- Unified table for storing synced data (Option A - simpler)
CREATE TABLE IF NOT EXISTS synced_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  synced_table_id UUID REFERENCES synced_tables(id) ON DELETE CASCADE,
  original_id TEXT NOT NULL,  -- Original row ID from external DB
  data JSONB NOT NULL,  -- Full row data
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(synced_table_id, original_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sync_jobs_database_id ON sync_jobs(database_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON sync_jobs(status);
CREATE INDEX IF NOT EXISTS idx_synced_tables_last_data_synced_at ON synced_tables(last_data_synced_at);
CREATE INDEX IF NOT EXISTS idx_synced_data_synced_table_id ON synced_data(synced_table_id);
CREATE INDEX IF NOT EXISTS idx_synced_data_original_id ON synced_data(original_id);
CREATE INDEX IF NOT EXISTS idx_synced_data_synced_at ON synced_data(synced_at);

-- GIN index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_synced_data_data_gin ON synced_data USING GIN (data);

