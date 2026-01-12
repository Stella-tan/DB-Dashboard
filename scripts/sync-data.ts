/**
 * Manual Data Sync Script
 * 
 * This script syncs data from ALL external databases stored in the external_databases table.
 * Databases can be added via:
 *   1. Environment variables (.env.local) - legacy support
 *   2. Web UI "Add Database" button - stored in external_databases table
 * 
 * Usage:
 *   npx ts-node scripts/sync-data.ts
 * # Sync ALL databases (UI-added + env)
 *   npm run sync
 * 
 * Options:
 *   --db-id=<id>   Sync only a specific database by ID
 *   --env-only     Sync only the database from environment variables (legacy mode)
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import mysql from 'mysql2/promise'

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

// =====================================================
// CONFIGURATION
// =====================================================

// Local MySQL configuration (data destination)
const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '1234qwer',
  database: process.env.MYSQL_DATABASE || 'dashboard_vibe2',
}

// Legacy: Environment-based Supabase credentials (optional fallback)
const ENV_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ENV_SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Tables to EXCLUDE from sync (system tables, etc.)
const TABLES_TO_EXCLUDE = [
  'schema_migrations',
  'spatial_ref_sys',
  // Add any other tables you want to skip
]

// =====================================================
// Types
// =====================================================

interface ExternalDatabase {
  id: string
  name: string
  description: string | null
  connection_string: string
  database_type: 'postgres' | 'mysql' | 'mongodb'
  sync_status: string
  last_synced_at: string | null
}

interface SyncResult {
  databaseId: string
  databaseName: string
  tables: Array<{ table: string; success: boolean; rows: number; error?: string }>
  totalRows: number
  successCount: number
  errorCount: number
}

// =====================================================
// Helper Functions
// =====================================================

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * Refresh dashboard cache for a database using existing config (no AI call)
 * This recomputes all chart/KPI data with fresh synced data
 */
async function refreshDashboardCache(
  mysqlConn: mysql.Connection,
  databaseId: string,
  databaseName: string
): Promise<void> {
  try {
    console.log(`\n🔄 Refreshing cache for: ${databaseName}`)
    
    // Check if dashboard config exists
    const [configRows] = await mysqlConn.execute(
      'SELECT config FROM ai_dashboard_configs WHERE database_id = ?',
      [databaseId]
    ) as any[]
    
    if (!configRows || configRows.length === 0) {
      console.log(`   ⏭️  No dashboard config found - skipping (generate via UI first)`)
      return
    }
    
    const config = typeof configRows[0].config === 'string' 
      ? JSON.parse(configRows[0].config) 
      : configRows[0].config
    
    const charts = config.charts || []
    const kpis = config.kpis || []
    
    if (charts.length === 0 && kpis.length === 0) {
      console.log(`   ⏭️  No charts/KPIs configured - skipping`)
      return
    }
    
    console.log(`   📊 Found ${charts.length} charts and ${kpis.length} KPIs to refresh`)
    
    // Clear existing cache
    await mysqlConn.execute(
      'DELETE FROM ai_dashboard_cache WHERE database_id = ?',
      [databaseId]
    )
    
    // Refresh each chart
    for (const chart of charts) {
      try {
        const data = await computeChartDataDirect(mysqlConn, databaseId, chart)
        await mysqlConn.execute(
          `INSERT INTO ai_dashboard_cache (id, database_id, item_id, item_type, config, computed_data, computed_at)
           VALUES (?, ?, ?, 'chart', ?, ?, NOW())`,
          [generateUUID(), databaseId, chart.id, JSON.stringify(chart), JSON.stringify(data)]
        )
        console.log(`      ✓ ${chart.title}`)
      } catch (err: any) {
        console.log(`      ✗ ${chart.title}: ${err.message}`)
      }
    }
    
    // Refresh each KPI
    for (const kpi of kpis) {
      try {
        const data = await computeKPIDataDirect(mysqlConn, databaseId, kpi)
        await mysqlConn.execute(
          `INSERT INTO ai_dashboard_cache (id, database_id, item_id, item_type, config, computed_data, computed_at)
           VALUES (?, ?, ?, 'kpi', ?, ?, NOW())`,
          [generateUUID(), databaseId, kpi.id, JSON.stringify(kpi), JSON.stringify(data)]
        )
        console.log(`      ✓ ${kpi.title}`)
      } catch (err: any) {
        console.log(`      ✗ ${kpi.title}: ${err.message}`)
      }
    }
    
    console.log(`   ✅ Cache refreshed!`)
  } catch (error: any) {
    console.log(`   ⚠️  Cache refresh failed: ${error.message}`)
  }
}

/**
 * Compute chart data directly using MySQL connection
 */
async function computeChartDataDirect(
  mysqlConn: mysql.Connection,
  databaseId: string,
  chart: any
): Promise<any[]> {
  const { table, columns, aggregation, type } = chart
  const xColumn = columns?.x
  const yColumn = columns?.y || 'id'
  const groupBy = columns?.groupBy

  const yPath = `$.${yColumn}`
  let aggregationExpr: string

  switch (aggregation) {
    case "count":
      aggregationExpr = `COUNT(*)`
      break
    case "sum":
      aggregationExpr = `COALESCE(SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '${yPath}')) AS DECIMAL(20,2))), 0)`
      break
    case "avg":
      aggregationExpr = `COALESCE(AVG(CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '${yPath}')) AS DECIMAL(20,2))), 0)`
      break
    case "min":
      aggregationExpr = `COALESCE(MIN(CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '${yPath}')) AS DECIMAL(20,2))), 0)`
      break
    case "max":
      aggregationExpr = `COALESCE(MAX(CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '${yPath}')) AS DECIMAL(20,2))), 0)`
      break
    default:
      aggregationExpr = `COUNT(*)`
  }

  // Simplified query - group by category or count
  if (type === "pie" || groupBy || xColumn) {
    const groupColumn = groupBy || xColumn
    if (!groupColumn) return []

    const groupPath = `$.${groupColumn}`
    const [rows] = await mysqlConn.execute(
      `SELECT 
        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '${groupPath}')), 'Unknown') as group_key,
        ${aggregationExpr} as result
       FROM synced_data
       WHERE database_id = ? AND table_name = ?
       GROUP BY group_key
       ORDER BY result DESC
       LIMIT 20`,
      [databaseId, table]
    ) as any[]

    return rows.map((row: any) => ({
      name: String(row.group_key),
      value: Math.round(parseFloat(String(row.result)) * 100) / 100
    }))
  }

  // Single aggregate
  const [rows] = await mysqlConn.execute(
    `SELECT ${aggregationExpr} as result FROM synced_data WHERE database_id = ? AND table_name = ?`,
    [databaseId, table]
  ) as any[]

  if (rows.length > 0) {
    return [{ value: Math.round(parseFloat(String(rows[0].result)) * 100) / 100 }]
  }
  return []
}

/**
 * Compute KPI data directly using MySQL connection
 */
async function computeKPIDataDirect(
  mysqlConn: mysql.Connection,
  databaseId: string,
  kpi: any
): Promise<{ value: number; growth: number }> {
  const { table, column, aggregation } = kpi
  const jsonPath = `$.${column}`

  let aggregationSQL: string
  switch (aggregation) {
    case "count":
      aggregationSQL = `COUNT(*)`
      break
    case "sum":
      aggregationSQL = `COALESCE(SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '${jsonPath}')) AS DECIMAL(20,2))), 0)`
      break
    case "avg":
      aggregationSQL = `COALESCE(AVG(CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '${jsonPath}')) AS DECIMAL(20,2))), 0)`
      break
    default:
      aggregationSQL = `COUNT(*)`
  }

  const [rows] = await mysqlConn.execute(
    `SELECT ${aggregationSQL} as result FROM synced_data WHERE database_id = ? AND table_name = ?`,
    [databaseId, table]
  ) as any[]

  const value = rows.length > 0 ? parseFloat(String(rows[0].result)) || 0 : 0
  return { value: Math.round(value * 100) / 100, growth: 0 }
}

/**
 * Parse connection string to extract credentials
 * Supports formats:
 *   - Supabase: "https://xxx.supabase.co|eyJhbGci..."
 *   - MySQL: "mysql://user:pass@host:port/database"
 *   - PostgreSQL: "postgres://user:pass@host:port/database"
 *   - MongoDB: "mongodb+srv://user:pass@cluster.mongodb.net/database"
 */
function parseConnectionString(connectionString: string, dbType: string): {
  type: 'supabase' | 'mysql' | 'postgres' | 'mongodb'
  url?: string
  key?: string
  host?: string
  port?: number
  user?: string
  password?: string
  database?: string
  uri?: string
} {
  // Supabase format: "url|key"
  if (connectionString.includes('supabase.co') && connectionString.includes('|')) {
    const [url, key] = connectionString.split('|')
    return { type: 'supabase', url, key }
  }
  
  // MySQL format: "mysql://user:pass@host:port/database"
  if (dbType === 'mysql' || connectionString.startsWith('mysql://')) {
    const url = new URL(connectionString)
    return {
      type: 'mysql',
      host: url.hostname,
      port: parseInt(url.port) || 3306,
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1),
    }
  }
  
  // PostgreSQL format: "postgres://user:pass@host:port/database"
  if (dbType === 'postgres' && connectionString.startsWith('postgres://')) {
    const url = new URL(connectionString)
    return {
      type: 'postgres',
      host: url.hostname,
      port: parseInt(url.port) || 5432,
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1),
    }
  }
  
  // MongoDB format: "mongodb+srv://..."
  if (dbType === 'mongodb' || connectionString.startsWith('mongodb')) {
    return { type: 'mongodb', uri: connectionString }
  }
  
  // Default: assume Supabase format
  if (connectionString.includes('|')) {
    const [url, key] = connectionString.split('|')
    return { type: 'supabase', url, key }
  }
  
  throw new Error(`Unable to parse connection string for database type: ${dbType}`)
}

async function connectToMySQL(): Promise<mysql.Connection> {
  console.log('🔌 Connecting to local MySQL...')
  console.log(`   Host: ${MYSQL_CONFIG.host}:${MYSQL_CONFIG.port}`)
  console.log(`   Database: ${MYSQL_CONFIG.database}`)
  
  return mysql.createConnection(MYSQL_CONFIG)
}

/**
 * Get all external databases from MySQL
 */
async function getAllExternalDatabases(mysqlConn: mysql.Connection): Promise<ExternalDatabase[]> {
  console.log('\n📋 Fetching external databases from MySQL...')
  
  const [rows] = await mysqlConn.execute(
    'SELECT id, name, description, connection_string, database_type, sync_status, last_synced_at FROM external_databases WHERE sync_enabled = 1 OR sync_enabled IS NULL'
  ) as any[]
  
  console.log(`   Found ${rows.length} database(s) to sync`)
  return rows
}

/**
 * Auto-discover all tables from Supabase
 */
async function discoverSupabaseTables(supabase: SupabaseClient): Promise<string[]> {
  console.log('   🔍 Auto-discovering tables...')
  
  try {
    // Method 1: Try using RPC function (if available)
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_tables', {})
    
    if (!rpcError && rpcData && Array.isArray(rpcData)) {
      const tables = rpcData.map((t: any) => t.table_name || t.tablename || t)
      console.log(`      ✅ Found ${tables.length} tables via RPC`)
      return tables.filter((t: string) => !TABLES_TO_EXCLUDE.includes(t))
    }
  } catch (e) {
    // RPC not available, try alternative method
  }
  
  // Method 2: Try to list tables by querying each possible table
  const possibleTables = [
    'users', 'orders', 'products', 'customers', 'items', 
    'transactions', 'analytics_events', 'events', 'logs',
    'categories', 'tags', 'comments', 'posts', 'articles',
    'invoices', 'payments', 'subscriptions', 'plans',
    'profiles', 'settings', 'notifications', 'messages',
    'accounts', 'sessions', 'tickets', 'reviews', 'ratings',
    'inventory', 'shipments', 'returns', 'refunds', 'coupons'
  ]
  
  const existingTables: string[] = []
  
  for (const tableName of possibleTables) {
    try {
      const { data, error } = await supabase.from(tableName).select('*').limit(1)
      if (!error) {
        existingTables.push(tableName)
        console.log(`      ✅ Found table: ${tableName}`)
      }
    } catch (e) {
      // Table doesn't exist, skip
    }
  }
  
  return existingTables.filter(t => !TABLES_TO_EXCLUDE.includes(t))
}

/**
 * Discover tables from MySQL client database
 */
async function discoverMySQLTables(config: {
  host: string
  port: number
  user: string
  password: string
  database: string
}): Promise<{ conn: mysql.Connection; tables: string[] }> {
  console.log('   🔍 Connecting to client MySQL...')
  
  const conn = await mysql.createConnection(config)
  
  const [rows] = await conn.execute(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = ?`,
    [config.database]
  ) as any[]
  
  const tables = rows
    .map((r: any) => r.table_name || r.TABLE_NAME)
    .filter((t: string) => !TABLES_TO_EXCLUDE.includes(t))
  
  console.log(`      ✅ Found ${tables.length} tables`)
  return { conn, tables }
}

async function ensureBaseSeedData(mysqlConn: mysql.Connection): Promise<void> {
  console.log('📦 Ensuring base seed data exists...')
  
  // Create default team
  const [teamRows] = await mysqlConn.execute('SELECT id FROM teams LIMIT 1') as any[]
  if (teamRows.length === 0) {
    console.log('   Creating default team...')
    await mysqlConn.execute(
      `INSERT INTO teams (id, name, description) VALUES (?, ?, ?)`,
      ['11111111-1111-1111-1111-111111111111', 'Default Team', 'Default team for all users']
    )
  }
  
  // Create default user
  const [userRows] = await mysqlConn.execute('SELECT id FROM users LIMIT 1') as any[]
  if (userRows.length === 0) {
    console.log('   Creating default user...')
    await mysqlConn.execute(
      `INSERT INTO users (id, email, name) VALUES (?, ?, ?)`,
      ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin@example.com', 'Admin User']
    )
  }
  
  // Create default chatbot
  const [chatbotRows] = await mysqlConn.execute('SELECT id FROM chatbots LIMIT 1') as any[]
  if (chatbotRows.length === 0) {
    console.log('   Creating default chatbot...')
    await mysqlConn.execute(
      `INSERT INTO chatbots (id, name, description, system_prompt, model) VALUES (?, ?, ?, ?, ?)`,
      [
        '99999999-9999-9999-9999-999999999991',
        'Data Assistant',
        'Helps query your database',
        'You are a helpful assistant that helps users query and understand their data. Be precise and clear.',
        'openai/gpt-4'
      ]
    )
  }
  
  console.log('   ✅ Base seed data ready')
}

/**
 * Create or update external database record from environment variables (legacy support)
 */
async function ensureEnvDatabase(mysqlConn: mysql.Connection): Promise<string | null> {
  if (!ENV_SUPABASE_URL || !ENV_SUPABASE_KEY || 
      ENV_SUPABASE_URL === 'YOUR_SUPABASE_URL' || 
      ENV_SUPABASE_KEY === 'YOUR_SUPABASE_ANON_KEY') {
    return null
  }
  
  const dbId = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
  
  // Check if external_database exists
  const [rows] = await mysqlConn.execute(
    'SELECT id FROM external_databases WHERE id = ?',
    [dbId]
  ) as any[]
  
  if (rows.length === 0) {
    console.log('📁 Creating external_database record from env vars...')
    await mysqlConn.execute(
      `INSERT INTO external_databases (id, name, description, connection_string, database_type, sync_status, sync_enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [dbId, 'Environment Supabase', 'Database from .env.local', `${ENV_SUPABASE_URL}|${ENV_SUPABASE_KEY}`, 'postgres', 'active', 1]
    )
    
    // Grant team access to database
    await mysqlConn.execute(
      `INSERT IGNORE INTO team_database_access (id, team_id, database_id) VALUES (?, ?, ?)`,
      [generateUUID(), '11111111-1111-1111-1111-111111111111', dbId]
    )
    
    // Grant chatbot access to database
    await mysqlConn.execute(
      `INSERT IGNORE INTO chatbot_database_access (id, chatbot_id, database_id, access_level) VALUES (?, ?, ?, ?)`,
      [generateUUID(), '99999999-9999-9999-9999-999999999991', dbId, 'read']
    )
    
    // Grant team access to chatbot
    await mysqlConn.execute(
      `INSERT IGNORE INTO team_chatbot_access (id, team_id, chatbot_id) VALUES (?, ?, ?)`,
      [generateUUID(), '11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999991']
    )
  }
  
  return dbId
}

async function ensureSyncedTable(
  mysqlConn: mysql.Connection,
  databaseId: string,
  tableName: string,
  columns: any[]
): Promise<string> {
  // Check if synced_table exists
  const [rows] = await mysqlConn.execute(
    'SELECT id FROM synced_tables WHERE database_id = ? AND table_name = ?',
    [databaseId, tableName]
  ) as any[]
  
  if (rows.length > 0) {
    return rows[0].id
  }
  
  // Create it
  const tableId = generateUUID()
  const schemaDefinition = JSON.stringify({ columns })
  
  console.log(`      📋 Registering table: ${tableName}`)
  await mysqlConn.execute(
    `INSERT INTO synced_tables (id, database_id, table_name, schema_definition, row_count)
     VALUES (?, ?, ?, ?, ?)`,
    [tableId, databaseId, tableName, schemaDefinition, 0]
  )
  
  return tableId
}

/**
 * Sync a single table from Supabase
 */
async function syncSupabaseTable(
  supabase: SupabaseClient,
  mysqlConn: mysql.Connection,
  databaseId: string,
  tableName: string
): Promise<{ success: boolean; rowsSynced: number; error?: string }> {
  try {
    // 1. Fetch data from Supabase
    const { data, error } = await supabase.from(tableName).select('*')
    
    if (error) {
      return { success: false, rowsSynced: 0, error: error.message }
    }
    
    if (!data || data.length === 0) {
      return { success: true, rowsSynced: 0 }
    }
    
    // 2. Infer columns from first row
    const columns = Object.keys(data[0]).map(name => ({
      name,
      type: typeof data[0][name]
    }))
    
    // 3. Ensure synced_table record exists
    const syncedTableId = await ensureSyncedTable(mysqlConn, databaseId, tableName, columns)
    
    // 4. Delete old synced_data for this table
    await mysqlConn.execute(
      'DELETE FROM synced_data WHERE synced_table_id = ?',
      [syncedTableId]
    )
    
    // 5. Insert new data
    let insertedCount = 0
    
    for (const row of data) {
      const originalId = row.id ? String(row.id) : generateUUID()
      const rowData = JSON.stringify(row)
      
      // Include database_id and table_name for optimized queries (denormalization)
      await mysqlConn.execute(
        `INSERT INTO synced_data (id, synced_table_id, database_id, table_name, original_id, data, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [generateUUID(), syncedTableId, databaseId, tableName, originalId, rowData]
      )
      insertedCount++
    }
    
    // 6. Update synced_tables metadata
    await mysqlConn.execute(
      `UPDATE synced_tables 
       SET row_count = ?, last_synced_at = NOW(), last_data_synced_at = NOW()
       WHERE id = ?`,
      [data.length, syncedTableId]
    )
    
    return { success: true, rowsSynced: insertedCount }
    
  } catch (error: any) {
    return { success: false, rowsSynced: 0, error: error.message }
  }
}

/**
 * Sync a single table from MySQL client database
 */
async function syncMySQLTable(
  clientConn: mysql.Connection,
  mysqlConn: mysql.Connection,
  databaseId: string,
  tableName: string
): Promise<{ success: boolean; rowsSynced: number; error?: string }> {
  try {
    // 1. Fetch data from client MySQL
    const [data] = await clientConn.execute(`SELECT * FROM \`${tableName}\``) as any[]
    
    if (!data || data.length === 0) {
      return { success: true, rowsSynced: 0 }
    }
    
    // 2. Infer columns from first row
    const columns = Object.keys(data[0]).map(name => ({
      name,
      type: typeof data[0][name]
    }))
    
    // 3. Ensure synced_table record exists
    const syncedTableId = await ensureSyncedTable(mysqlConn, databaseId, tableName, columns)
    
    // 4. Delete old synced_data for this table
    await mysqlConn.execute(
      'DELETE FROM synced_data WHERE synced_table_id = ?',
      [syncedTableId]
    )
    
    // 5. Insert new data
    let insertedCount = 0
    
    for (const row of data) {
      const originalId = row.id ? String(row.id) : generateUUID()
      const rowData = JSON.stringify(row)
      
      // Include database_id and table_name for optimized queries (denormalization)
      await mysqlConn.execute(
        `INSERT INTO synced_data (id, synced_table_id, database_id, table_name, original_id, data, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [generateUUID(), syncedTableId, databaseId, tableName, originalId, rowData]
      )
      insertedCount++
    }
    
    // 6. Update synced_tables metadata
    await mysqlConn.execute(
      `UPDATE synced_tables 
       SET row_count = ?, last_synced_at = NOW(), last_data_synced_at = NOW()
       WHERE id = ?`,
      [data.length, syncedTableId]
    )
    
    return { success: true, rowsSynced: insertedCount }
    
  } catch (error: any) {
    return { success: false, rowsSynced: 0, error: error.message }
  }
}

/**
 * Sync a single external database
 */
async function syncDatabase(
  mysqlConn: mysql.Connection,
  db: ExternalDatabase
): Promise<SyncResult> {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`📦 Syncing: ${db.name} (${db.database_type})`)
  console.log(`   ID: ${db.id}`)
  console.log(`${'═'.repeat(60)}`)
  
  const result: SyncResult = {
    databaseId: db.id,
    databaseName: db.name,
    tables: [],
    totalRows: 0,
    successCount: 0,
    errorCount: 0,
  }
  
  try {
    // Update sync status to syncing
    await mysqlConn.execute(
      `UPDATE external_databases SET sync_status = 'syncing' WHERE id = ?`,
      [db.id]
    )
    
    const credentials = parseConnectionString(db.connection_string, db.database_type)
    
    // Handle Supabase/PostgreSQL
    if (credentials.type === 'supabase' && credentials.url && credentials.key) {
      console.log(`   🔌 Connecting to Supabase: ${credentials.url.substring(0, 30)}...`)
      const supabase = createClient(credentials.url, credentials.key)
      
      // Discover tables
      const tables = await discoverSupabaseTables(supabase)
      
      if (tables.length === 0) {
        console.log('   ⚠️  No tables found')
      } else {
        console.log(`   📋 Syncing ${tables.length} tables...`)
        
        for (const tableName of tables) {
          process.stdout.write(`      🔄 ${tableName}... `)
          const tableResult = await syncSupabaseTable(supabase, mysqlConn, db.id, tableName)
          
          if (tableResult.success) {
            console.log(`✅ ${tableResult.rowsSynced} rows`)
            result.successCount++
            result.totalRows += tableResult.rowsSynced
          } else {
            console.log(`❌ ${tableResult.error}`)
            result.errorCount++
          }
          
          result.tables.push({
            table: tableName,
            success: tableResult.success,
            rows: tableResult.rowsSynced,
            error: tableResult.error,
          })
        }
      }
    }
    // Handle MySQL client database
    else if (credentials.type === 'mysql' && credentials.host) {
      const { conn: clientConn, tables } = await discoverMySQLTables({
        host: credentials.host,
        port: credentials.port || 3306,
        user: credentials.user || '',
        password: credentials.password || '',
        database: credentials.database || '',
      })
      
      try {
        if (tables.length === 0) {
          console.log('   ⚠️  No tables found')
        } else {
          console.log(`   📋 Syncing ${tables.length} tables...`)
          
          for (const tableName of tables) {
            process.stdout.write(`      🔄 ${tableName}... `)
            const tableResult = await syncMySQLTable(clientConn, mysqlConn, db.id, tableName)
            
            if (tableResult.success) {
              console.log(`✅ ${tableResult.rowsSynced} rows`)
              result.successCount++
              result.totalRows += tableResult.rowsSynced
            } else {
              console.log(`❌ ${tableResult.error}`)
              result.errorCount++
            }
            
            result.tables.push({
              table: tableName,
              success: tableResult.success,
              rows: tableResult.rowsSynced,
              error: tableResult.error,
            })
          }
        }
      } finally {
        await clientConn.end()
      }
    }
    // Handle MongoDB (not yet implemented)
    else if (credentials.type === 'mongodb') {
      console.log('   ⚠️  MongoDB sync not yet implemented')
      result.errorCount++
    }
    // Unknown type
    else {
      console.log(`   ❌ Unknown database type or invalid credentials`)
      result.errorCount++
    }
    
    // Update sync status and last_synced_at
    await mysqlConn.execute(
      `UPDATE external_databases SET sync_status = 'active', last_synced_at = NOW() WHERE id = ?`,
      [db.id]
    )
    
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`)
    result.errorCount++
    
    // Update sync status to error
    await mysqlConn.execute(
      `UPDATE external_databases SET sync_status = 'error' WHERE id = ?`,
      [db.id]
    )
  }
  
  return result
}

// =====================================================
// Main Function
// =====================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗')
  console.log('║              Multi-Database Sync Script                        ║')
  console.log('║   Syncs ALL databases from external_databases table            ║')
  console.log('╚════════════════════════════════════════════════════════════════╝')
  console.log('')
  
  // Parse command line arguments
  const args = process.argv.slice(2)
  const specificDbId = args.find(a => a.startsWith('--db-id='))?.split('=')[1]
  const envOnly = args.includes('--env-only')
  
  if (specificDbId) {
    console.log(`🎯 Syncing specific database: ${specificDbId}`)
  }
  if (envOnly) {
    console.log(`🎯 Environment-only mode: Syncing only .env.local database`)
  }
  
  let mysqlConn: mysql.Connection | null = null
  
  try {
    // Connect to local MySQL
    mysqlConn = await connectToMySQL()
    console.log('   ✅ MySQL connected')
    
    // Ensure base seed data exists (teams, users, chatbots)
    await ensureBaseSeedData(mysqlConn)
    
    // Ensure env-based database exists (legacy support)
    const envDbId = await ensureEnvDatabase(mysqlConn)
    if (envDbId) {
      console.log(`   ✅ Environment database ready: ${envDbId}`)
    }
    
    // Get databases to sync
    let databasesToSync: ExternalDatabase[] = []
    
    if (envOnly && envDbId) {
      // Only sync env database
      const [rows] = await mysqlConn.execute(
        'SELECT * FROM external_databases WHERE id = ?',
        [envDbId]
      ) as any[]
      databasesToSync = rows
    } else if (specificDbId) {
      // Only sync specific database
      const [rows] = await mysqlConn.execute(
        'SELECT * FROM external_databases WHERE id = ?',
        [specificDbId]
      ) as any[]
      databasesToSync = rows
    } else {
      // Sync all databases
      databasesToSync = await getAllExternalDatabases(mysqlConn)
    }
    
    if (databasesToSync.length === 0) {
      console.log('\n⚠️  No databases found to sync!')
      console.log('   Add a database via the web UI or configure .env.local')
      return
    }
    
    // Sync each database
    const allResults: SyncResult[] = []
    
    for (const db of databasesToSync) {
      const result = await syncDatabase(mysqlConn, db)
      allResults.push(result)
    }
    
    // Refresh dashboard cache for each synced database (using existing config, no AI)
    console.log('\n')
    console.log('╔════════════════════════════════════════════════════════════════╗')
    console.log('║                REFRESHING DASHBOARD CACHE                      ║')
    console.log('╚════════════════════════════════════════════════════════════════╝')
    
    for (const db of databasesToSync) {
      await refreshDashboardCache(mysqlConn, db.id, db.name)
    }
    
    // Print summary
    console.log('\n')
    console.log('╔════════════════════════════════════════════════════════════════╗')
    console.log('║                      SYNC SUMMARY                              ║')
    console.log('╚════════════════════════════════════════════════════════════════╝')
    
    let grandTotalRows = 0
    let grandTotalTables = 0
    let grandTotalErrors = 0
    
    for (const result of allResults) {
      console.log(`\n📦 ${result.databaseName}`)
      console.log(`   Tables: ${result.successCount} synced, ${result.errorCount} errors`)
      console.log(`   Rows: ${result.totalRows.toLocaleString()}`)
      
      grandTotalRows += result.totalRows
      grandTotalTables += result.successCount
      grandTotalErrors += result.errorCount
    }
    
    console.log('\n' + '─'.repeat(64))
    console.log(`📊 TOTAL: ${allResults.length} databases, ${grandTotalTables} tables, ${grandTotalRows.toLocaleString()} rows`)
    if (grandTotalErrors > 0) {
      console.log(`⚠️  ${grandTotalErrors} table(s) failed to sync`)
    }
    console.log('')
    console.log('🎉 Sync complete! Refresh your browser to see the data.')
    
  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message)
    process.exit(1)
  } finally {
    if (mysqlConn) {
      await mysqlConn.end()
    }
  }
}

// Run the script
main()
