# DB Dashboard

A dynamic database analytics dashboard with AI-powered chart generation.

## Features

- **Multi-Database Support**: Connect multiple external databases (MySQL, PostgreSQL via Supabase)
- **AI-Powered Dashboard**: Automatically generates optimal charts and KPIs based on your data
- **Auto Table Discovery**: Detects tables, columns, and sample data automatically
- **Persistent Configurations**: AI-generated dashboards are saved and reused
- **Chatbot Integration**: Built-in AI chatbot for data queries

## Getting Started

### Prerequisites

- Node.js 18+
- MySQL 8.0+ (local database for storing configs)
- An AI API key (OpenRouter, OpenAI, or compatible)

### Environment Setup

Create a `.env.local` file in the project root:

```env
# Local MySQL Database (stores configurations and synced data)
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=dashboard_vibe2

# AI Configuration (for dashboard generation)
# Option 1: OpenRouter (recommended - supports multiple models)
AI_API_KEY=your_openrouter_api_key
AI_BASE_URL=https://openrouter.ai/api/v1
AI_MODEL=openai/gpt-4o-mini

# Option 2: OpenAI Direct
# AI_API_KEY=your_openai_api_key
# AI_BASE_URL=https://api.openai.com/v1
# AI_MODEL=gpt-4o-mini

# Option 3: Other OpenAI-compatible APIs
# AI_API_KEY=your_api_key
# AI_BASE_URL=https://your-api-endpoint.com/v1
# AI_MODEL=your-model-name

# Legacy: External Supabase (optional - for syncing external databases)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Database Setup

1. Create the MySQL database:
```sql
CREATE DATABASE dashboard_vibe2;
```

2. Run the schema scripts in order:
```bash
# In MySQL Workbench or CLI
mysql -u root -p dashboard_vibe2 < scripts/001_initial_schema_mysql.sql
mysql -u root -p dashboard_vibe2 < scripts/003_sync_schema_mysql.sql
mysql -u root -p dashboard_vibe2 < scripts/007_ai_dashboard_schema.sql
```

### Running the Development Server

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## How the AI Dashboard Works

1. **Table Discovery**: When you select a database, the system fetches all synced tables with their columns and 5 sample rows.

2. **AI Analysis**: If no saved configuration exists, the AI analyzes the data structure and sample data to recommend:
   - 3-4 KPI cards (key metrics)
   - 4-6 charts (trends, distributions, comparisons)

3. **Configuration Storage**: The AI's recommendations are saved to MySQL so they persist across page refreshes.

4. **Regeneration**: Click "Regenerate" to ask the AI for a fresh dashboard layout.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ai-dashboard/discover` | GET | Discover tables and sample data |
| `/api/ai-dashboard/generate` | POST | Generate AI dashboard config |
| `/api/ai-dashboard/config` | GET | Load saved configuration |
| `/api/ai-dashboard/config` | DELETE | Delete config (for regeneration) |
| `/api/ai-dashboard/chart-data` | POST | Fetch data for a chart |
| `/api/ai-dashboard/kpi-data` | POST | Fetch data for a KPI |

## Syncing External Databases

1. Add a database via the UI "Add Database" button
2. Run the sync script:
```bash
npm run sync
```

Or sync a specific database:
```bash
npx ts-node scripts/sync-data.ts --db-id=your-database-id
```

## Supported AI Providers

- **OpenRouter** (recommended): Access to 100+ models including GPT-4, Claude, Llama, etc.
- **OpenAI**: Direct API access
- **Any OpenAI-compatible API**: Ollama, LocalAI, Azure OpenAI, etc.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [OpenRouter API](https://openrouter.ai/docs)
- [Recharts Documentation](https://recharts.org/en-US)
