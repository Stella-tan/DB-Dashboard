"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Database, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

type DatabaseType = "supabase" | "mysql" | "mongodb" | "postgres"

interface AddDatabaseDialogProps {
  onDatabaseAdded?: () => void
  children?: React.ReactNode
}

interface DatabaseFormData {
  name: string
  description: string
  database_type: DatabaseType
  // Supabase fields
  supabase_url?: string
  supabase_key?: string
  // MySQL/PostgreSQL fields
  host?: string
  port?: string
  username?: string
  password?: string
  database?: string
  // MongoDB fields
  mongodb_uri?: string
}

export function AddDatabaseDialog({ onDatabaseAdded, children }: AddDatabaseDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  
  const [formData, setFormData] = useState<DatabaseFormData>({
    name: "",
    description: "",
    database_type: "supabase",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Build connection string based on database type
      let connectionString = ""
      
      switch (formData.database_type) {
        case "supabase":
          if (!formData.supabase_url || !formData.supabase_key) {
            throw new Error("Supabase URL and Key are required")
          }
          connectionString = `${formData.supabase_url}|${formData.supabase_key}`
          break
        
        case "mysql":
          if (!formData.host || !formData.username || !formData.password || !formData.database) {
            throw new Error("Host, Username, Password, and Database are required")
          }
          connectionString = `mysql://${formData.username}:${formData.password}@${formData.host}:${formData.port || "3306"}/${formData.database}`
          break
        
        case "postgres":
          if (!formData.host || !formData.username || !formData.password || !formData.database) {
            throw new Error("Host, Username, Password, and Database are required")
          }
          connectionString = `postgres://${formData.username}:${formData.password}@${formData.host}:${formData.port || "5432"}/${formData.database}`
          break
        
        case "mongodb":
          if (!formData.mongodb_uri) {
            throw new Error("MongoDB URI is required")
          }
          connectionString = formData.mongodb_uri
          break
      }

      const response = await fetch("/api/databases/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          database_type: formData.database_type === "supabase" ? "postgres" : formData.database_type,
          connection_string: connectionString,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to add database")
      }

      toast({
        title: "Database Added",
        description: `Successfully connected to ${formData.name}`,
      })

      // Reset form and close dialog
      setFormData({
        name: "",
        description: "",
        database_type: "supabase",
      })
      setOpen(false)
      onDatabaseAdded?.()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const updateField = (field: keyof DatabaseFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            Add Database
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Add Database Connection
          </DialogTitle>
          <DialogDescription>
            Connect your external database to sync and visualize your data.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Database Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Production Database"
                value={formData.name}
                onChange={(e) => updateField("name", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Brief description of this database..."
                value={formData.description}
                onChange={(e) => updateField("description", e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="database_type">Database Type *</Label>
              <Select
                value={formData.database_type}
                onValueChange={(value) => updateField("database_type", value as DatabaseType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select database type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="supabase">
                    <div className="flex items-center gap-2">
                      <span className="text-green-500">●</span>
                      Supabase (PostgreSQL)
                    </div>
                  </SelectItem>
                  <SelectItem value="mysql">
                    <div className="flex items-center gap-2">
                      <span className="text-blue-500">●</span>
                      MySQL
                    </div>
                  </SelectItem>
                  <SelectItem value="postgres">
                    <div className="flex items-center gap-2">
                      <span className="text-indigo-500">●</span>
                      PostgreSQL (Direct)
                    </div>
                  </SelectItem>
                  <SelectItem value="mongodb">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-500">●</span>
                      MongoDB
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Supabase Fields */}
          {formData.database_type === "supabase" && (
            <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
              <h4 className="font-medium text-sm text-muted-foreground">Supabase Credentials</h4>
              <div className="space-y-2">
                <Label htmlFor="supabase_url">Project URL *</Label>
                <Input
                  id="supabase_url"
                  placeholder="https://xxxxx.supabase.co"
                  value={formData.supabase_url || ""}
                  onChange={(e) => updateField("supabase_url", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supabase_key">Anon / Service Key *</Label>
                <Input
                  id="supabase_key"
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                  value={formData.supabase_key || ""}
                  onChange={(e) => updateField("supabase_key", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Found in Supabase Dashboard → Settings → API
                </p>
              </div>
            </div>
          )}

          {/* MySQL / PostgreSQL Fields */}
          {(formData.database_type === "mysql" || formData.database_type === "postgres") && (
            <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
              <h4 className="font-medium text-sm text-muted-foreground">
                {formData.database_type === "mysql" ? "MySQL" : "PostgreSQL"} Connection
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="host">Host *</Label>
                  <Input
                    id="host"
                    placeholder="localhost or IP"
                    value={formData.host || ""}
                    onChange={(e) => updateField("host", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="port">Port</Label>
                  <Input
                    id="port"
                    placeholder={formData.database_type === "mysql" ? "3306" : "5432"}
                    value={formData.port || ""}
                    onChange={(e) => updateField("port", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="database">Database Name *</Label>
                <Input
                  id="database"
                  placeholder="my_database"
                  value={formData.database || ""}
                  onChange={(e) => updateField("database", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username *</Label>
                  <Input
                    id="username"
                    placeholder="db_user"
                    value={formData.username || ""}
                    onChange={(e) => updateField("username", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={formData.password || ""}
                    onChange={(e) => updateField("password", e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* MongoDB Fields */}
          {formData.database_type === "mongodb" && (
            <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
              <h4 className="font-medium text-sm text-muted-foreground">MongoDB Connection</h4>
              <div className="space-y-2">
                <Label htmlFor="mongodb_uri">Connection URI *</Label>
                <Input
                  id="mongodb_uri"
                  placeholder="mongodb+srv://user:pass@cluster.mongodb.net/dbname"
                  value={formData.mongodb_uri || ""}
                  onChange={(e) => updateField("mongodb_uri", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Found in MongoDB Atlas → Connect → Drivers
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.name}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Database className="w-4 h-4 mr-2" />
                  Add Database
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

