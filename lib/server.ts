/**
 * Server-side database client
 * Now uses MySQL instead of Supabase for local storage
 */
import { getMySQLClient } from "./db-mysql"

export async function getSupabaseServerClient() {
  // Return MySQL client with Supabase-like interface
  return getMySQLClient()
}
