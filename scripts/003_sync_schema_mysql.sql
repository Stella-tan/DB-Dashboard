-- MySQL Sync Schema for Dashboard Vibe2
-- Run this in MySQL Workbench on schema: dashboard_vibe2
-- Database: localhost:3306, Username: root, Password: 1234qwer

USE dashboard_vibe2;

-- Sync jobs - track synchronization tasks
CREATE TABLE IF NOT EXISTS sync_jobs (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  database_id CHAR(36) NOT NULL,
  table_name VARCHAR(255) NULL,
  status ENUM('pending', 'running', 'completed', 'error') NOT NULL,
  started_at DATETIME NULL,
  completed_at DATETIME NULL,
  rows_synced INT DEFAULT 0,
  error_message TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (database_id) REFERENCES external_databases(id) ON DELETE CASCADE
);

-- Add sync schedule columns to external_databases
-- MySQL doesn't support IF NOT EXISTS for ALTER TABLE, so we check first
SET @dbname = DATABASE();
SET @tablename = 'external_databases';
SET @columnname1 = 'sync_schedule';
SET @columnname2 = 'sync_enabled';

-- Add sync_schedule column if not exists
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname1)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname1, ' ENUM(\'manual\', \'hourly\', \'daily\', \'weekly\') DEFAULT \'manual\'')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add sync_enabled column if not exists
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname2)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname2, ' BOOLEAN DEFAULT TRUE')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add last data sync time to synced_tables
SET @tablename = 'synced_tables';
SET @columnname = 'last_data_synced_at';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' DATETIME NULL')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Unified table for storing synced data
CREATE TABLE IF NOT EXISTS synced_data (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  synced_table_id CHAR(36) NOT NULL,
  original_id VARCHAR(255) NOT NULL,  -- Original row ID from external DB
  data JSON NOT NULL,  -- Full row data
  synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (synced_table_id) REFERENCES synced_tables(id) ON DELETE CASCADE,
  UNIQUE KEY unique_synced_table_original (synced_table_id, original_id)
);

-- Create indexes for performance
CREATE INDEX idx_sync_jobs_database_id ON sync_jobs(database_id);
CREATE INDEX idx_sync_jobs_status ON sync_jobs(status);
CREATE INDEX idx_synced_tables_last_data_synced_at ON synced_tables(last_data_synced_at);
CREATE INDEX idx_synced_data_synced_table_id ON synced_data(synced_table_id);
CREATE INDEX idx_synced_data_original_id ON synced_data(original_id);
CREATE INDEX idx_synced_data_synced_at ON synced_data(synced_at);
