-- Performance Indexes for Dashboard Queries
-- Run this in MySQL Workbench on schema: dashboard_vibe2
-- Database: localhost:3306, Username: root, Password: 1234qwer
--
-- This script adds:
-- 1. Denormalized database_id column to synced_data for faster queries (eliminates JOIN)
-- 2. Composite indexes for common query patterns
-- 3. Backfills database_id for existing data

USE dashboard_vibe2;

-- ============================================================================
-- STEP 1: Add database_id column to synced_data (denormalization)
-- This eliminates the expensive JOIN with synced_tables on every query
-- ============================================================================

-- Check if column exists and add it if not
SET @dbname = DATABASE();
SET @tablename = 'synced_data';
SET @columnname = 'database_id';

SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT "Column database_id already exists"',
  'ALTER TABLE synced_data ADD COLUMN database_id CHAR(36) NULL AFTER synced_table_id'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add table_name column for direct access (avoid JOIN)
SET @columnname = 'table_name';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT "Column table_name already exists"',
  'ALTER TABLE synced_data ADD COLUMN table_name VARCHAR(255) NULL AFTER database_id'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- ============================================================================
-- STEP 2: Backfill database_id and table_name from synced_tables
-- ============================================================================

UPDATE synced_data sd
JOIN synced_tables st ON sd.synced_table_id = st.id
SET sd.database_id = st.database_id,
    sd.table_name = st.table_name
WHERE sd.database_id IS NULL;

-- ============================================================================
-- STEP 3: Create optimized indexes (MySQL-compatible syntax)
-- ============================================================================

-- Drop idx_synced_data_db_table if exists
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'synced_data' AND INDEX_NAME = 'idx_synced_data_db_table') > 0,
  'DROP INDEX idx_synced_data_db_table ON synced_data',
  'SELECT 1'
));
PREPARE dropIndex FROM @preparedStatement;
EXECUTE dropIndex;
DEALLOCATE PREPARE dropIndex;

-- Primary composite index for dashboard queries (most important!)
-- This index covers: WHERE database_id = ? AND table_name = ?
CREATE INDEX idx_synced_data_db_table ON synced_data(database_id, table_name);

-- Drop idx_synced_tables_db_table if exists
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'synced_tables' AND INDEX_NAME = 'idx_synced_tables_db_table') > 0,
  'DROP INDEX idx_synced_tables_db_table ON synced_tables',
  'SELECT 1'
));
PREPARE dropIndex FROM @preparedStatement;
EXECUTE dropIndex;
DEALLOCATE PREPARE dropIndex;

-- Covering index for synced_tables lookups
CREATE INDEX idx_synced_tables_db_table ON synced_tables(database_id, table_name, id);

-- Drop idx_synced_data_db_table_synced if exists
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'synced_data' AND INDEX_NAME = 'idx_synced_data_db_table_synced') > 0,
  'DROP INDEX idx_synced_data_db_table_synced ON synced_data',
  'SELECT 1'
));
PREPARE dropIndex FROM @preparedStatement;
EXECUTE dropIndex;
DEALLOCATE PREPARE dropIndex;

-- Index on synced_data for synced_at queries (growth calculations)
CREATE INDEX idx_synced_data_db_table_synced ON synced_data(database_id, table_name, synced_at);

-- ============================================================================
-- STEP 4: Add trigger to auto-populate database_id and table_name on INSERT
-- ============================================================================

DROP TRIGGER IF EXISTS tr_synced_data_populate_db_info;

DELIMITER //
CREATE TRIGGER tr_synced_data_populate_db_info
BEFORE INSERT ON synced_data
FOR EACH ROW
BEGIN
  IF NEW.database_id IS NULL OR NEW.table_name IS NULL THEN
    SELECT database_id, table_name INTO @db_id, @tbl_name
    FROM synced_tables
    WHERE id = NEW.synced_table_id;
    
    SET NEW.database_id = @db_id;
    SET NEW.table_name = @tbl_name;
  END IF;
END//
DELIMITER ;

-- ============================================================================
-- VERIFICATION: Check the indexes were created
-- ============================================================================

SELECT 
  'synced_data indexes:' as info,
  INDEX_NAME, 
  COLUMN_NAME, 
  SEQ_IN_INDEX
FROM INFORMATION_SCHEMA.STATISTICS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'synced_data'
ORDER BY INDEX_NAME, SEQ_IN_INDEX;

SELECT 
  'synced_tables indexes:' as info,
  INDEX_NAME, 
  COLUMN_NAME, 
  SEQ_IN_INDEX
FROM INFORMATION_SCHEMA.STATISTICS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'synced_tables'
ORDER BY INDEX_NAME, SEQ_IN_INDEX;

-- Show table statistics
SELECT 
  'Table row counts:' as info,
  TABLE_NAME, 
  TABLE_ROWS
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME IN ('synced_data', 'synced_tables', 'external_databases');

