// This script debugs and prints all tables and columns from Supabase
// Run with: npx tsx scripts/debug-tables.ts

import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"
import { join } from "path"

// Load environment variables from .env.local
function loadEnvFile() {
  try {
    const envPath = join(__dirname, "../.env.local")
    const envFile = readFileSync(envPath, "utf-8")
    const envVars: Record<string, string> = {}
    
    envFile.split("\n").forEach((line) => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=")
        if (key && valueParts.length > 0) {
          const value = valueParts.join("=").trim().replace(/^["']|["']$/g, "")
          envVars[key.trim()] = value
        }
      }
    })
    
    Object.assign(process.env, envVars)
  } catch (error) {
    console.warn("⚠️  Could not load .env.local file, using process.env")
  }
}

loadEnvFile()

async function debugTables() {
  console.log("🔍 Debugging Supabase Tables and Columns...\n")

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing environment variables")
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log("📊 Method 1: Querying known application tables directly\n")
  
  // List of known tables from the schema
  const knownTables = [
    "teams",
    "users",
    "team_members",
    "external_databases",
    "team_database_access",
    "synced_tables",
    "chatbots",
    "chatbot_database_access",
    "team_chatbot_access",
    "dashboard_configs",
    "chart_configs",
    "chat_messages",
  ]

  console.log(`Testing ${knownTables.length} known tables:\n`)
  
  const accessibleTables: Array<{ name: string; columns?: any[]; sample?: any }> = []
  
  for (const tableName of knownTables) {
    try {
      // Try to get a sample row to see if table exists and get column info
      const { data, error, count } = await supabase
        .from(tableName)
        .select("*")
        .limit(1)

      if (error) {
        if (error.code === "PGRST116") {
          console.log(`   ⚠️  Table '${tableName}': Does not exist`)
        } else {
          console.log(`   ⚠️  Table '${tableName}': ${error.message}`)
        }
      } else {
        console.log(`   ✅ Table '${tableName}': Accessible (${count || 0} rows)`)
        
        // Get column names from sample data
        const columns = data && data.length > 0 ? Object.keys(data[0]) : []
        accessibleTables.push({
          name: tableName,
          columns: columns.map(col => ({ name: col, type: typeof data[0][col] })),
          sample: data && data.length > 0 ? data[0] : undefined
        })
        
        if (columns.length > 0) {
          console.log(`      Columns: ${columns.join(", ")}`)
        }
      }
    } catch (err: any) {
      console.log(`   ❌ Table '${tableName}': ${err.message}`)
    }
  }

  if (accessibleTables.length > 0) {
    console.log(`\n✅ Found ${accessibleTables.length} accessible tables with details:\n`)
    accessibleTables.forEach((table) => {
      console.log(`📋 Table: ${table.name}`)
      if (table.columns && table.columns.length > 0) {
        console.log(`   Columns (${table.columns.length}):`)
        table.columns.forEach((col) => {
          console.log(`     - ${col.name}: ${col.type}`)
        })
      }
      if (table.sample) {
        console.log(`   Sample row keys: ${Object.keys(table.sample).join(", ")}`)
      }
      console.log("")
    })
  }

  console.log("\n" + "=".repeat(60))
  console.log("📊 Method 2: Querying synced_tables (Application metadata)\n")

  try {
    const { data: syncedTables, error: syncedError } = await supabase
      .from("synced_tables")
      .select("*")
      .order("table_name")

    if (syncedError) {
      console.error(`❌ Error querying synced_tables: ${syncedError.message}`)
    } else if (syncedTables && syncedTables.length > 0) {
      console.log(`✅ Found ${syncedTables.length} synced tables:\n`)
      
      syncedTables.forEach((table) => {
        console.log(`📋 Table: ${table.table_name}`)
        console.log(`   Database ID: ${table.database_id}`)
        console.log(`   Row Count: ${table.row_count || 0}`)
        console.log(`   Last Synced: ${table.last_synced_at || "Never"}`)
        
        if (table.schema_definition) {
          const schema = typeof table.schema_definition === "string" 
            ? JSON.parse(table.schema_definition) 
            : table.schema_definition
          
          if (schema.columns && Array.isArray(schema.columns)) {
            console.log(`   Columns (${schema.columns.length}):`)
            schema.columns.forEach((col: any) => {
              console.log(`     - ${col.name}: ${col.type || "unknown"}`)
            })
          } else {
            console.log(`   Schema: ${JSON.stringify(schema, null, 2)}`)
          }
        }
        console.log("")
      })
    } else {
      console.log("⚠️  No synced tables found")
    }
  } catch (err: any) {
    console.error(`❌ Error: ${err.message}`)
  }

  console.log("\n" + "=".repeat(60))
  console.log("📊 Method 3: Querying external_databases\n")

  try {
    const { data: databases, error: dbError } = await supabase
      .from("external_databases")
      .select("*")
      .order("name")

    if (dbError) {
      console.error(`❌ Error querying external_databases: ${dbError.message}`)
    } else if (databases && databases.length > 0) {
      console.log(`✅ Found ${databases.length} external databases:\n`)
      
      databases.forEach((db) => {
        console.log(`📦 Database: ${db.name}`)
        console.log(`   ID: ${db.id}`)
        console.log(`   Type: ${db.database_type}`)
        console.log(`   Status: ${db.sync_status}`)
        console.log(`   Last Synced: ${db.last_synced_at || "Never"}`)
        console.log("")
      })
    } else {
      console.log("⚠️  No external databases found")
    }
  } catch (err: any) {
    console.error(`❌ Error: ${err.message}`)
  }

  console.log("\n" + "=".repeat(60))
  console.log("📊 Method 4: Trying RPC call to get all tables\n")

  try {
    // Try using a PostgreSQL function if available
    const { data: rpcData, error: rpcError } = await supabase.rpc("get_all_tables")
    
    if (rpcError) {
      console.log(`ℹ️  RPC function not available: ${rpcError.message}`)
      console.log("   (This is normal - RPC functions need to be created in Supabase)")
    } else {
      console.log("✅ RPC Result:", JSON.stringify(rpcData, null, 2))
    }
  } catch (err: any) {
    console.log(`ℹ️  RPC call failed: ${err.message}`)
  }

  console.log("\n✨ Debug completed!")
}

// Run the debug
debugTables().catch((error) => {
  console.error("\n❌ Fatal error:", error)
  process.exit(1)
})

