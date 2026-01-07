# Dashboard Setup Guide

## 架构概述

```
┌─────────────────────────────────────────────────────────────────┐
│                         系统架构                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   客户 Supabase (数据来源)          本地 MySQL (数据存储)         │
│   ┌──────────────┐                 ┌──────────────┐             │
│   │  users       │    npm run     │  synced_data │             │
│   │  orders      │  ─────────────>│  teams       │             │
│   │  products    │     sync       │  chatbots    │             │
│   └──────────────┘                 │  etc...      │             │
│                                    └──────────────┘             │
│   (只在同步时访问)                   (UI 读取数据)               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 快速开始

### 前提条件

- Node.js 18+
- MySQL 8.0+ (本地安装)
- 客户的 Supabase URL 和 Anon Key

---

## 步骤 1：安装依赖

```bash
npm install
```

---

## 步骤 2：配置环境变量

创建 `.env.local` 文件：

```env
# 客户的 Supabase 凭据 (数据来源)
NEXT_PUBLIC_SUPABASE_URL=https://你的项目.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的anon_key

# 本地 MySQL 配置 (数据存储)
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=你的密码
MYSQL_DATABASE=dashboard_vibe2
```

---

## 步骤 3：创建 MySQL 数据库

打开 MySQL Workbench 或命令行：

```sql
CREATE DATABASE dashboard_vibe2;
USE dashboard_vibe2;
```

---

## 步骤 4：运行数据库 Schema

在 MySQL Workbench 中按顺序运行以下脚本：

1. **`scripts/001_initial_schema_mysql.sql`** - 创建基础表结构
2. **`scripts/003_sync_schema_mysql.sql`** - 创建同步相关表

---

## 步骤 5：同步数据

### 5.1 配置要同步的表

编辑 `scripts/sync-data.ts`，修改 `TABLES_TO_SYNC` 数组为你客户 Supabase 中的实际表名：

```typescript
const TABLES_TO_SYNC = [
  'users',      // 改成你客户数据库中的表名
  'orders',
  'products',
]
```

### 5.2 运行同步命令

```bash
npm run sync
```

这个命令会：
- ✅ 自动创建基础数据（teams, users, chatbots）
- ✅ 注册外部数据库连接
- ✅ 从客户 Supabase 拉取数据
- ✅ 存储到本地 MySQL

---

## 步骤 6：启动开发服务器

```bash
npm run dev
```

打开 http://localhost:3000/dashboard

---

## 日常使用

### 同步数据（手动）

每次需要更新数据时，运行：

```bash
npm run sync
```

### 数据流向

| 操作 | 数据来源 |
|------|----------|
| 用户打开 Dashboard | 本地 MySQL ✅ |
| 用户查看图表 | 本地 MySQL ✅ |
| 运行 `npm run sync` | Supabase → MySQL |

---

## 文件结构

```
scripts/
├── 001_initial_schema_mysql.sql  # 基础表结构
├── 003_sync_schema_mysql.sql     # 同步相关表
├── sync-data.ts                  # 同步脚本
└── tsconfig.json                 # 脚本 TypeScript 配置

lib/
├── mysql.ts                      # MySQL 连接池
├── db-mysql.ts                   # MySQL 查询构建器
├── server.ts                     # 服务端数据库客户端
├── client.ts                     # 浏览器端数据库客户端
└── sync.ts                       # 同步逻辑
```

---

## 故障排除

### 问题：`npm run sync` 报错 "ECONNREFUSED"

**原因**：MySQL 服务未启动

**解决**：启动 MySQL 服务

### 问题：`npm run sync` 报错 "Unknown database"

**原因**：数据库未创建

**解决**：运行 `CREATE DATABASE dashboard_vibe2;`

### 问题：`npm run sync` 报错 "Table doesn't exist"

**原因**：Schema 脚本未运行

**解决**：运行 `001_initial_schema_mysql.sql` 和 `003_sync_schema_mysql.sql`

### 问题：UI 显示 "No Databases Connected"

**原因**：同步脚本未运行

**解决**：运行 `npm run sync`

---

## 重新同步

如果需要完全重新同步：

```sql
-- 在 MySQL 中清空数据
USE dashboard_vibe2;
TRUNCATE TABLE synced_data;
UPDATE synced_tables SET row_count = 0, last_synced_at = NULL, last_data_synced_at = NULL;
```

然后重新运行：

```bash
npm run sync
```

