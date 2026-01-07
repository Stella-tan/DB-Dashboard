-- ⚠️ 警告：只在客户的 Supabase 中运行此脚本
-- 此脚本会删除所有同步相关的表和应用表
-- 只保留客户的业务表

-- 步骤 1: 删除同步相关的表

DROP TABLE IF EXISTS sync_jobs CASCADE;
DROP TABLE IF EXISTS synced_data CASCADE;
DROP TABLE IF EXISTS synced_tables CASCADE;
DROP TABLE IF EXISTS external_databases CASCADE;

-- 步骤 2: 删除应用相关的表（如果存在）

DROP TABLE IF EXISTS chart_configs CASCADE;
DROP TABLE IF EXISTS dashboard_configs CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS team_chatbot_access CASCADE;
DROP TABLE IF EXISTS chatbot_database_access CASCADE;
DROP TABLE IF EXISTS chatbots CASCADE;
DROP TABLE IF EXISTS team_database_access CASCADE;
DROP TABLE IF EXISTS team_members CASCADE;
DROP TABLE IF EXISTS users CASCADE;  -- 注意：如果客户有自己的 users 表，不要删除
DROP TABLE IF EXISTS teams CASCADE;

-- 步骤 3: 验证清理结果

-- 检查是否还有同步相关的表
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ 清理成功：没有同步相关的表'
    ELSE '⚠️ 警告：仍有 ' || COUNT(*) || ' 个同步相关的表'
  END as cleanup_status
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'external_databases',
  'synced_tables',
  'synced_data',
  'sync_jobs',
  'chart_configs',
  'dashboard_configs',
  'chat_messages',
  'team_chatbot_access',
  'chatbot_database_access',
  'chatbots',
  'team_database_access',
  'team_members',
  'teams'
);

-- 显示剩余的表（应该只有客户的业务表）
SELECT 
  'Remaining tables:' as info,
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name NOT LIKE 'pg_%'
AND table_name NOT LIKE '_%'
ORDER BY table_name;


