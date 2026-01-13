# DB Dashboard

An AI-assisted analytics dashboard that connects to multiple databases, discovers tables automatically, and generates charts/KPIs with minimal setup.

## Key Capabilities
- Multi-database support: local MySQL for configs plus external MySQL/Postgres (via Supabase).
- AI-generated layouts: KPIs and charts proposed from schema + sample rows.
- Auto table discovery: pulls columns and sample data for each synced table.
- Persistent configs: AI decisions are stored in MySQL for fast reloads.
- Regeneration on demand: ask the AI for a fresh dashboard anytime.
- Built-in chatbot: conversational data questions against your synced sources.

## Tech Stack
- Next.js + React for UI
- MySQL for persisted configs and synced data
- TypeScript throughout
- Recharts for visualizations
- AI providers: OpenRouter (recommended), OpenAI, or any OpenAI-compatible endpoint

## Quick Start
1) Prerequisites
- Node.js 18+
- MySQL 8.0+ available locally
- AI API key (OpenRouter, OpenAI, or compatible)

2) Install dependencies
```bash
npm install
```

3) Configure environment
Create `.env.local` in the project root:
```env
# Local MySQL used for configs + synced data
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=dashboard_vibe2

# AI provider (pick one)
# OpenRouter (recommended)
AI_API_KEY=your_openrouter_api_key
AI_BASE_URL=https://openrouter.ai/api/v1
AI_MODEL=openai/gpt-4o-mini

# OpenAI direct
# AI_API_KEY=your_openai_api_key
# AI_BASE_URL=https://api.openai.com/v1
# AI_MODEL=gpt-4o-mini

# Any OpenAI-compatible endpoint
# AI_API_KEY=your_api_key
# AI_BASE_URL=https://your-api-endpoint.com/v1
# AI_MODEL=your-model-name

# Optional: legacy Supabase connection for syncing external DBs
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4) Initialize database schema
```sql
CREATE DATABASE dashboard_vibe2;
```
Then run the schema scripts in order (Workbench or CLI):
```bash
mysql -u root -p dashboard_vibe2 < scripts/001_initial_schema_mysql.sql
mysql -u root -p dashboard_vibe2 < scripts/003_sync_schema_mysql.sql
mysql -u root -p dashboard_vibe2 < scripts/007_ai_dashboard_schema.sql
```

5) Start the dev server
```bash
npm run dev
```
Open http://localhost:3000.

## How It Works
1. Table discovery: selecting a database fetches synced tables, columns, and 5 sample rows.
2. AI analysis: if no saved layout exists, the AI proposes 3–4 KPIs and 4–6 charts.
3. Persistence: the generated layout is stored in MySQL and reused on reload.
4. Regenerate: click Regenerate to request a new AI layout.

## API Surface
| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/ai-dashboard/discover` | GET | Discover tables and sample data |
| `/api/ai-dashboard/generate` | POST | Generate AI dashboard config |
| `/api/ai-dashboard/config` | GET | Load saved configuration |
| `/api/ai-dashboard/config` | DELETE | Remove saved config for regeneration |
| `/api/ai-dashboard/chart-data` | POST | Fetch chart data |
| `/api/ai-dashboard/kpi-data` | POST | Fetch KPI data |

## Syncing External Databases
1) Add the database via the UI (“Add Database”).  
2) Run a full sync:
```bash
npm run sync
```
To sync a specific database:
```bash
npx ts-node scripts/sync-data.ts --db-id=your-database-id
```

## Common Tasks
- Lint: `npm run lint`
- Format: `npm run format` (if configured)
- Type check: `npm run type-check` (if available)
- Build: `npm run build`

## Troubleshooting
- Connection errors: verify MySQL is running and `.env.local` matches your credentials.
- AI errors: confirm `AI_API_KEY`, `AI_BASE_URL`, and `AI_MODEL`; check provider quotas.
- Schema mismatches: rerun the three schema scripts in order to reconcile drift.
- No charts generated: ensure the selected database has tables with sample rows.

## Notes on AI Providers
- OpenRouter recommended: broader model access and competitive pricing.
- OpenAI direct: straightforward if you already use OpenAI keys.
- Custom endpoints: any OpenAI-compatible API should work with the same env vars.

## Learn More
- Next.js docs: https://nextjs.org/docs
- OpenRouter docs: https://openrouter.ai/docs
- Recharts docs: https://recharts.org/en-US
