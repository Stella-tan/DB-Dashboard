import { createClient, SupabaseClient } from "@supabase/supabase-js"
import { getSupabaseServerClient } from "./server"
import { MySQLClient } from "./db-mysql"

export interface SyncResult {
  success: boolean
  rowsSynced: number
  error?: string
  tableName: string
}

/**
 * Connect to external Supabase database
 * Connection string format: "supabase://project_ref:anon_key" or "url|key"
 */
export async function connectToExternalDatabase(connectionString: string): Promise<SupabaseClient> {
  try {
    // Format 1: supabase://project_ref:anon_key
    if (connectionString.startsWith("supabase://")) {
      const parts = connectionString.replace("supabase://", "").split(":")
      if (parts.length !== 2) {
        throw new Error("Invalid supabase:// format. Expected: supabase://project_ref:anon_key")
      }
      const projectRef = parts[0]
      const anonKey = parts[1]
      const url = `https://${projectRef}.supabase.co`
      
      return createClient(url, anonKey)
    }
    
    // Format 2: url|key (URL and key separated by |)
    if (connectionString.includes("|")) {
      const [url, key] = connectionString.split("|")
      if (!url || !key) {
        throw new Error("Invalid format. Expected: url|key")
      }
      return createClient(url.trim(), key.trim())
    }
    
    // Format 3: Try as direct Supabase URL (if it contains supabase.co)
    if (connectionString.includes("supabase.co")) {
      // Assume it's a URL, need key separately
      throw new Error("Please provide connection string in format: supabase://project_ref:anon_key or url|key")
    }
    
    throw new Error("Invalid connection string format. Use: supabase://project_ref:anon_key or url|key")
  } catch (error: any) {
    throw new Error(`Failed to connect to external database: ${error.message}`)
  }
}

/**
 * Get table data from external database
 */
export async function fetchTableData(
  externalClient: SupabaseClient,
  tableName: string,
  limit?: number
): Promise<any[]> {
  const query = externalClient.from(tableName).select("*")
  
  if (limit) {
    query.limit(limit)
  }
  
  const { data, error } = await query
  
  if (error) {
    throw new Error(`Failed to fetch data from ${tableName}: ${error.message}`)
  }
  
  return data || []
}

/**
 * MANUAL SYNC: Fetch data from external (client) Supabase and store in local MySQL storage
 * This function:
 * 1. Connects to client's Supabase (external database)
 * 2. Fetches all data from the specified table
 * 3. Stores it in our local MySQL (synced_data table)
 * 4. Updates metadata in synced_tables
 * 
 * After sync, all queries should read from local storage, not external database
 */
export async function syncTableData(
  databaseId: string,
  tableName: string,
  externalClient: SupabaseClient,
  localClient: MySQLClient
): Promise<SyncResult> {
  try {
    // 1. Fetch data from external database
    console.log(`Fetching data from external table: ${tableName}`)
    const externalData = await fetchTableData(externalClient, tableName)
    
    if (externalData.length === 0) {
      console.log(`No data found in table: ${tableName}`)
      return {
        success: true,
        rowsSynced: 0,
        tableName,
      }
    }
    
    console.log(`Fetched ${externalData.length} rows from ${tableName}`)
    
    // 2. Get synced_table record
    const tableResult = await localClient
      .from("synced_tables")
      .select("id")
      .eq("database_id", databaseId)
      .eq("table_name", tableName)
      .single()
    
    if (tableResult.error || !tableResult.data) {
      throw new Error(`Synced table record not found for ${tableName}. Please register the table first.`)
    }
    
    const syncedTable = tableResult.data
    
    // 3. Delete old data for this table
    console.log(`Deleting old synced data for table: ${tableName}`)
    const { error: deleteError } = await localClient.delete("synced_data", {
      synced_table_id: syncedTable.id,
    })
    
    if (deleteError) {
      console.warn(`Warning: Failed to delete old data: ${deleteError.message}`)
    }
    
    // 4. Prepare records for insertion (include database_id and table_name for optimized queries)
    const recordsToInsert = externalData.map((row) => {
      // Use row.id if exists, otherwise generate a unique identifier
      const originalId = row.id 
        ? String(row.id) 
        : JSON.stringify(Object.entries(row).sort().map(([k, v]) => `${k}:${v}`)).substring(0, 100)
      
      return {
        synced_table_id: syncedTable.id,
        database_id: databaseId,  // Denormalized for faster queries
        table_name: tableName,    // Denormalized for faster queries
        original_id: originalId,
        data: row,
        synced_at: new Date().toISOString(),
      }
    })
    
    console.log(`Inserting ${recordsToInsert.length} records into synced_data`)
    
    // 5. Insert new data in batches of 1000
    const batchSize = 1000
    let totalInserted = 0
    
    for (let i = 0; i < recordsToInsert.length; i += batchSize) {
      const batch = recordsToInsert.slice(i, i + batchSize)
      const { error: insertError } = await localClient.insert("synced_data", batch)
      
      if (insertError) {
        // If batch fails, try inserting one by one to find the problematic record
        console.error(`Batch insert failed: ${insertError.message}`)
        throw new Error(`Failed to insert batch ${Math.floor(i / batchSize) + 1}: ${insertError.message}`)
      }
      
      totalInserted += batch.length
      console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} records`)
    }
    
    // 6. Update synced_tables metadata
    await localClient.update(
      "synced_tables",
      {
        row_count: externalData.length,
        last_data_synced_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
      },
      { id: syncedTable.id }
    )
    
    console.log(`Successfully synced ${totalInserted} rows for table: ${tableName}`)
    
    return {
      success: true,
      rowsSynced: totalInserted,
      tableName,
    }
  } catch (error: any) {
    console.error(`Sync error for ${tableName}:`, error)
    return {
      success: false,
      rowsSynced: 0,
      error: error.message,
      tableName,
    }
  }
}

/**
 * Get all tables that need syncing for a database
 */
export async function getTablesToSync(
  localClient: MySQLClient,
  databaseId: string
): Promise<Array<{ id: string; table_name: string; last_data_synced_at: string | null }>> {
  const { data, error } = await localClient
    .from("synced_tables")
    .select(["id", "table_name", "last_data_synced_at"])
    .eq("database_id", databaseId)
    .executeQuery()
  
  if (error) {
    throw new Error(`Failed to get tables: ${error.message}`)
  }
  
  return data || []
}

