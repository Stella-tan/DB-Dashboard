-- =====================================================
-- MySQL Seed Data Script
-- Run this in MySQL Workbench on dashboard_vibe2 database
-- =====================================================

-- Insert sample teams
INSERT IGNORE INTO teams (id, name, description) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Engineering Team', 'Main engineering team'),
  ('22222222-2222-2222-2222-222222222222', 'Analytics Team', 'Data analytics and reporting team'),
  ('33333333-3333-3333-3333-333333333333', 'Marketing Team', 'Marketing and growth team');

-- Insert sample users
INSERT IGNORE INTO users (id, email, name) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin@example.com', 'Admin User'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'analyst@example.com', 'Data Analyst'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'marketer@example.com', 'Marketing Manager');

-- Assign users to teams
INSERT IGNORE INTO team_members (team_id, user_id, role) VALUES
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin'),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'admin'),
  ('33333333-3333-3333-3333-333333333333', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'admin'),
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'member');

-- =====================================================
-- IMPORTANT: Update this with your actual Supabase credentials!
-- Format: supabase://PROJECT_REF:ANON_KEY
-- Or: https://PROJECT_REF.supabase.co|ANON_KEY
-- =====================================================

-- Insert external databases (these represent your CLIENT's Supabase databases)
INSERT IGNORE INTO external_databases (id, name, description, connection_string, database_type, sync_status, last_synced_at) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Client Supabase', 'Client main database', 'YOUR_SUPABASE_URL|YOUR_SUPABASE_ANON_KEY', 'supabase', 'active', NOW() - INTERVAL 5 MINUTE);

-- If you want to test with dummy data, you can use these sample databases:
-- INSERT IGNORE INTO external_databases (id, name, description, connection_string, database_type, sync_status, last_synced_at) VALUES
--   ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Production DB', 'Main production database', 'postgresql://user:pass@prod.example.com:5432/prod', 'postgres', 'active', NOW() - INTERVAL 5 MINUTE),
--   ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Analytics DB', 'Analytics and reporting database', 'postgresql://user:pass@analytics.example.com:5432/analytics', 'postgres', 'active', NOW() - INTERVAL 10 MINUTE),
--   ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Customer DB', 'Customer data warehouse', 'postgresql://user:pass@customer.example.com:5432/customer', 'postgres', 'active', NOW() - INTERVAL 15 MINUTE);

-- Grant team access to databases
INSERT IGNORE INTO team_database_access (team_id, database_id) VALUES
  ('11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  ('22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  ('33333333-3333-3333-3333-333333333333', 'dddddddd-dddd-dddd-dddd-dddddddddddd');

-- Insert sample synced tables (these represent tables you want to sync from client's DB)
-- You should update table_name and schema_definition based on actual client tables
INSERT IGNORE INTO synced_tables (id, database_id, table_name, schema_definition, row_count, last_synced_at) VALUES
  ('aaaaaaaa-0001-0001-0001-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'users', '{"columns": [{"name": "id", "type": "uuid"}, {"name": "email", "type": "text"}, {"name": "name", "type": "text"}, {"name": "created_at", "type": "timestamp"}]}', 0, NULL),
  ('aaaaaaaa-0001-0001-0001-000000000002', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'orders', '{"columns": [{"name": "id", "type": "uuid"}, {"name": "user_id", "type": "uuid"}, {"name": "total", "type": "decimal"}, {"name": "status", "type": "text"}]}', 0, NULL),
  ('aaaaaaaa-0001-0001-0001-000000000003', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'products', '{"columns": [{"name": "id", "type": "uuid"}, {"name": "name", "type": "text"}, {"name": "price", "type": "decimal"}, {"name": "stock", "type": "integer"}]}', 0, NULL);

-- Insert sample chatbots
INSERT IGNORE INTO chatbots (id, name, description, system_prompt, model) VALUES
  ('99999999-9999-9999-9999-999999999991', 'Data Assistant', 'Helps query database', 'You are a helpful assistant that helps users query the database. Always be precise and clear in your responses.', 'openai/gpt-4'),
  ('99999999-9999-9999-9999-999999999992', 'Analytics Bot', 'Specialized in analytics queries', 'You are an analytics expert that helps users understand their data. Provide insights and visualizations when possible.', 'openai/gpt-4'),
  ('99999999-9999-9999-9999-999999999993', 'Customer Insights', 'Customer data specialist', 'You are a customer success specialist that helps analyze customer data and segments.', 'openai/gpt-4');

-- Grant chatbot access to databases
INSERT IGNORE INTO chatbot_database_access (chatbot_id, database_id, access_level) VALUES
  ('99999999-9999-9999-9999-999999999991', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'read'),
  ('99999999-9999-9999-9999-999999999992', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'read'),
  ('99999999-9999-9999-9999-999999999993', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'read');

-- Grant teams access to chatbots
INSERT IGNORE INTO team_chatbot_access (team_id, chatbot_id) VALUES
  ('11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999991'),
  ('11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999992'),
  ('22222222-2222-2222-2222-222222222222', '99999999-9999-9999-9999-999999999992'),
  ('22222222-2222-2222-2222-222222222222', '99999999-9999-9999-9999-999999999993'),
  ('33333333-3333-3333-3333-333333333333', '99999999-9999-9999-9999-999999999993');

-- =====================================================
-- Verify data was inserted
-- =====================================================
SELECT 'Teams:' as '', COUNT(*) as count FROM teams;
SELECT 'Users:' as '', COUNT(*) as count FROM users;
SELECT 'External Databases:' as '', COUNT(*) as count FROM external_databases;
SELECT 'Synced Tables:' as '', COUNT(*) as count FROM synced_tables;
SELECT 'Chatbots:' as '', COUNT(*) as count FROM chatbots;


