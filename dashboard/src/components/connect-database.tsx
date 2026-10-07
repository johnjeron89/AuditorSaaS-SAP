'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Copy, Check, Database, Download } from 'lucide-react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sbpjtynofivcddmctjnh.supabase.co'

interface ConnectDatabaseProps {
  tenantId: string
  hasCredentials: boolean
  lastAgentSeenAt?: string | null
  dbEngine?: string | null
}

export function ConnectDatabase({
  tenantId,
  hasCredentials,
  lastAgentSeenAt,
  dbEngine: existingEngine,
}: ConnectDatabaseProps) {
  const router = useRouter()
  const supabase = createClient()
  const [engine, setEngine] = useState<'postgres' | 'mysql'>('postgres')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleGenerateKey = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session?.access_token) {
        throw new Error('Your session has expired. Please sign in again.')
      }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-agent-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify({ tenant_id: tenantId, db_engine: engine }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || `Server returned ${res.status}`)
      }

      setApiKey(data.api_key)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate key'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const envVarsPostgres = `export AGENT_API_KEY="${apiKey || '<your-api-key>'}"
export TENANT_ID="${tenantId}"
export DATABASE_URL="postgresql://auditor_readonly:YOUR_PASSWORD@localhost:5432/your_database"
export AUDIT_API_URL="https://sbpjtynofivcddmctjnh.supabase.co/functions/v1/agent-submit-database-audit"`

  const envVarsMysql = `export AGENT_API_KEY="${apiKey || '<your-api-key>'}"
export TENANT_ID="${tenantId}"
export MYSQL_HOST="localhost"
export MYSQL_PORT="3306"
export MYSQL_USER="auditor_readonly"
export MYSQL_PASSWORD="YOUR_PASSWORD"
export MYSQL_DATABASE="mysql"
export AUDIT_API_URL="https://sbpjtynofivcddmctjnh.supabase.co/functions/v1/agent-submit-database-audit"`

  // Already connected — show status
  if (hasCredentials && !apiKey) {
    return (
      <Card className="border border-green-500/20 bg-green-500/[0.03] rounded-none">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 text-sm font-medium">
              Agent Key Configured — {existingEngine === 'mysql' ? 'MySQL' : 'PostgreSQL'}
            </span>
          </div>
          {lastAgentSeenAt ? (
            <p className="text-white/40 text-xs pl-5">
              Last agent submission: {new Date(lastAgentSeenAt).toLocaleString()}
            </p>
          ) : (
            <p className="text-amber-400/70 text-xs pl-5">
              ⏳ Waiting for first agent submission…
            </p>
          )}
          <div className="pl-5 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateKey}
              disabled={loading}
              className="text-xs border-white/10 text-white/60 hover:text-white rounded-none"
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Regenerate Key
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Show the generated key + instructions
  if (apiKey) {
    const selectedEnvVars = engine === 'postgres' ? envVarsPostgres : envVarsMysql
    const agentScript = engine === 'postgres' ? 'postgres-audit-agent.ts' : 'mysql-audit-agent.ts'
    const roleScript = engine === 'postgres' ? 'postgres-create-readonly-role.sql' : 'mysql-create-readonly-role.sql'

    return (
      <Card className="border border-blue-500/20 bg-blue-500/[0.03] rounded-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <Database className="h-4 w-4 text-blue-400" />
            Agent Setup — {engine === 'postgres' ? 'PostgreSQL' : 'MySQL'}
          </CardTitle>
          <CardDescription className="text-white/50">
            Save the API key below — it will not be shown again.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* API Key */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-white/50">API Key (one-time display)</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-black/40 border border-white/10 p-2 text-green-400 font-mono break-all">
                {apiKey}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(apiKey)}
                className="border-white/10 rounded-none shrink-0"
              >
                {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3 text-white/60" />}
              </Button>
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-3 text-sm">
            <div className="space-y-1">
              <p className="text-white/70 font-medium">1. Create the read-only role on your database:</p>
              <p className="text-white/40 text-xs">
                Run <code className="text-blue-400">{roleScript}</code> as a superuser on your DB server.
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-white/70 font-medium">2. Set environment variables:</p>
              <div className="relative">
                <pre className="text-xs bg-black/40 border border-white/10 p-3 text-white/70 font-mono overflow-x-auto">
                  {selectedEnvVars}
                </pre>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(selectedEnvVars)}
                  className="absolute top-1 right-1 h-6 w-6 p-0 text-white/40 hover:text-white"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-white/70 font-medium">3. Run the agent:</p>
              <pre className="text-xs bg-black/40 border border-white/10 p-3 text-white/70 font-mono">
{`cd agent
npm install
npx tsx ${agentScript}`}
              </pre>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => { setApiKey(null); router.refresh() }}
            className="w-full border-white/10 text-white/60 hover:text-white rounded-none text-sm"
          >
            Done — Return to Tenant
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Initial state — pick engine and generate key
  return (
    <Card className="border border-amber-500/20 bg-amber-500/[0.03] rounded-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-white flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-amber-400" />
          Connect Database Agent
        </CardTitle>
        <CardDescription className="text-white/50">
          Generate an API key for the audit agent. The agent runs on your network — no database credentials are shared with us.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Engine selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-white/60">Database Engine</label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setEngine('postgres')}
              className={`flex-1 p-3 border text-sm font-medium transition-all ${
                engine === 'postgres'
                  ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
                  : 'border-white/10 bg-white/[0.02] text-white/50 hover:text-white/70'
              }`}
            >
              🐘 PostgreSQL
            </button>
            <button
              type="button"
              onClick={() => setEngine('mysql')}
              className={`flex-1 p-3 border text-sm font-medium transition-all ${
                engine === 'mysql'
                  ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
                  : 'border-white/10 bg-white/[0.02] text-white/50 hover:text-white/70'
              }`}
            >
              🐬 MySQL
            </button>
          </div>
        </div>

        {error && (
          <div className="text-red-400 text-xs p-2 bg-red-500/10 border border-red-500/20 rounded-none">
            {error}
          </div>
        )}

        <Button
          onClick={handleGenerateKey}
          disabled={loading}
          className="w-full bg-white text-black hover:bg-white/90 rounded-none h-11"
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating...</>
          ) : (
            'Generate Agent API Key →'
          )}
        </Button>

        <p className="text-white/30 text-xs text-center">
          The agent runs <code className="text-white/40">read-only</code> queries on your server and sends the results to our API. No DB password is ever shared.
        </p>
      </CardContent>
    </Card>
  )
}
