-- MySQL Schema for Dashboard Vibe2
-- Run this in MySQL Workbench on schema: dashboard_vibe2
-- Database: localhost:3306, Username: root, Password: 1234qwer

USE dashboard_vibe2;

-- Teams table - represents different teams/organizations
CREATE TABLE IF NOT EXISTS teams (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Users table - for team members
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Team members - users belonging to teams
CREATE TABLE IF NOT EXISTS team_members (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  team_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  role ENUM('admin', 'member', 'viewer') NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_team_user (team_id, user_id)
);

-- External databases - databases that sync to this system
CREATE TABLE IF NOT EXISTS external_databases (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  connection_string TEXT NOT NULL,
  database_type ENUM('postgres', 'mysql', 'mongodb') NOT NULL,
  sync_status ENUM('pending', 'syncing', 'active', 'error') DEFAULT 'pending',
  last_synced_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Team database access - which teams can access which databases
CREATE TABLE IF NOT EXISTS team_database_access (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  team_id CHAR(36) NOT NULL,
  database_id CHAR(36) NOT NULL,
  granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (database_id) REFERENCES external_databases(id) ON DELETE CASCADE,
  UNIQUE KEY unique_team_database (team_id, database_id)
);

-- Synced tables - tables synced from external databases
CREATE TABLE IF NOT EXISTS synced_tables (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  database_id CHAR(36) NOT NULL,
  table_name VARCHAR(255) NOT NULL,
  schema_definition JSON NOT NULL,
  row_count INT DEFAULT 0,
  last_synced_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (database_id) REFERENCES external_databases(id) ON DELETE CASCADE,
  UNIQUE KEY unique_database_table (database_id, table_name)
);

-- Chatbots - AI assistants with database access
CREATE TABLE IF NOT EXISTS chatbots (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  model VARCHAR(255) DEFAULT 'openai/gpt-5',
  temperature DECIMAL(3,2) DEFAULT 0.7,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Chatbot database access - which databases each chatbot can query
CREATE TABLE IF NOT EXISTS chatbot_database_access (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  chatbot_id CHAR(36) NOT NULL,
  database_id CHAR(36) NOT NULL,
  access_level ENUM('read', 'write') DEFAULT 'read',
  granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (chatbot_id) REFERENCES chatbots(id) ON DELETE CASCADE,
  FOREIGN KEY (database_id) REFERENCES external_databases(id) ON DELETE CASCADE,
  UNIQUE KEY unique_chatbot_database (chatbot_id, database_id)
);

-- Team chatbot access - which teams can use which chatbots
CREATE TABLE IF NOT EXISTS team_chatbot_access (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  team_id CHAR(36) NOT NULL,
  chatbot_id CHAR(36) NOT NULL,
  granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (chatbot_id) REFERENCES chatbots(id) ON DELETE CASCADE,
  UNIQUE KEY unique_team_chatbot (team_id, chatbot_id)
);

-- Dashboard configurations - saved dashboard layouts
CREATE TABLE IF NOT EXISTS dashboard_configs (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36) NOT NULL,
  team_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  layout JSON NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

-- Chart configurations - individual chart settings
CREATE TABLE IF NOT EXISTS chart_configs (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  dashboard_id CHAR(36) NOT NULL,
  database_id CHAR(36) NULL,
  chart_type ENUM('line', 'bar', 'pie', 'area', 'scatter', 'table') NOT NULL,
  title VARCHAR(255) NOT NULL,
  data_source JSON NOT NULL,
  filters JSON DEFAULT ('[]'),
  position JSON NOT NULL,
  size JSON NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (dashboard_id) REFERENCES dashboard_configs(id) ON DELETE CASCADE,
  FOREIGN KEY (database_id) REFERENCES external_databases(id) ON DELETE SET NULL
);

-- Chat messages - conversation history
CREATE TABLE IF NOT EXISTS chat_messages (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  chatbot_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  role ENUM('user', 'assistant', 'system') NOT NULL,
  content TEXT NOT NULL,
  metadata JSON DEFAULT ('{}'),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (chatbot_id) REFERENCES chatbots(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
CREATE INDEX idx_external_databases_sync_status ON external_databases(sync_status);
CREATE INDEX idx_team_database_access_team_id ON team_database_access(team_id);
CREATE INDEX idx_team_database_access_database_id ON team_database_access(database_id);
CREATE INDEX idx_synced_tables_database_id ON synced_tables(database_id);
CREATE INDEX idx_chatbot_database_access_chatbot_id ON chatbot_database_access(chatbot_id);
CREATE INDEX idx_chatbot_database_access_database_id ON chatbot_database_access(database_id);
CREATE INDEX idx_team_chatbot_access_team_id ON team_chatbot_access(team_id);
CREATE INDEX idx_team_chatbot_access_chatbot_id ON team_chatbot_access(chatbot_id);
CREATE INDEX idx_chart_configs_dashboard_id ON chart_configs(dashboard_id);
CREATE INDEX idx_chat_messages_chatbot_id ON chat_messages(chatbot_id);
CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id);


