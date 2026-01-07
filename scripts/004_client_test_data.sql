-- 在客户的 Supabase 中运行此脚本
-- 创建测试业务表和测试数据

-- 步骤 1: 创建业务表

-- Users 表
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders 表
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  total DECIMAL(10, 2) NOT NULL CHECK (total >= 0),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products 表
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  stock INTEGER DEFAULT 0 CHECK (stock >= 0),
  category TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 步骤 2: 插入测试数据

-- 插入用户
INSERT INTO users (email, name, status) VALUES
  ('john.doe@example.com', 'John Doe', 'active'),
  ('jane.smith@example.com', 'Jane Smith', 'active'),
  ('bob.johnson@example.com', 'Bob Johnson', 'inactive'),
  ('alice.brown@example.com', 'Alice Brown', 'active'),
  ('charlie.wilson@example.com', 'Charlie Wilson', 'active'),
  ('diana.prince@example.com', 'Diana Prince', 'active'),
  ('edward.norton@example.com', 'Edward Norton', 'suspended'),
  ('fiona.apple@example.com', 'Fiona Apple', 'active')
ON CONFLICT (email) DO NOTHING;

-- 插入订单（为每个用户创建多个订单）
INSERT INTO orders (user_id, total, status)
SELECT 
  u.id,
  (RANDOM() * 1000 + 10)::DECIMAL(10, 2) as total,
  CASE 
    WHEN RANDOM() > 0.7 THEN 'completed'
    WHEN RANDOM() > 0.4 THEN 'processing'
    WHEN RANDOM() > 0.2 THEN 'pending'
    ELSE 'cancelled'
  END as status
FROM users u
CROSS JOIN generate_series(1, 15)  -- 每个用户 15 个订单
ORDER BY RANDOM();

-- 插入产品
INSERT INTO products (name, price, stock, category, description) VALUES
  ('MacBook Pro 16"', 2499.99, 25, 'Electronics', 'High-performance laptop'),
  ('Wireless Mouse', 29.99, 200, 'Electronics', 'Ergonomic wireless mouse'),
  ('Mechanical Keyboard', 129.99, 150, 'Electronics', 'RGB mechanical keyboard'),
  ('4K Monitor 27"', 399.99, 75, 'Electronics', 'Ultra HD monitor'),
  ('Noise Cancelling Headphones', 299.99, 100, 'Electronics', 'Premium headphones'),
  ('Standing Desk', 499.99, 30, 'Furniture', 'Adjustable standing desk'),
  ('Ergonomic Chair', 349.99, 40, 'Furniture', 'Comfortable office chair'),
  ('Desk Lamp', 49.99, 80, 'Furniture', 'LED desk lamp'),
  ('USB-C Hub', 79.99, 120, 'Electronics', 'Multi-port USB-C hub'),
  ('Webcam HD', 89.99, 90, 'Electronics', '1080p webcam')
ON CONFLICT DO NOTHING;

-- 步骤 3: 创建索引以提高查询性能

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);

-- 步骤 4: 验证数据

-- 查看数据统计
SELECT 
  'users' as table_name,
  COUNT(*) as row_count,
  MIN(created_at) as first_record,
  MAX(created_at) as last_record
FROM users
UNION ALL
SELECT 
  'orders',
  COUNT(*),
  MIN(created_at),
  MAX(created_at)
FROM orders
UNION ALL
SELECT 
  'products',
  COUNT(*),
  MIN(created_at),
  MAX(created_at)
FROM products;

-- 查看示例数据
SELECT 'Sample Users:' as info;
SELECT id, email, name, status FROM users LIMIT 5;

SELECT 'Sample Orders:' as info;
SELECT id, user_id, total, status FROM orders LIMIT 5;

SELECT 'Sample Products:' as info;
SELECT id, name, price, stock, category FROM products LIMIT 5;


