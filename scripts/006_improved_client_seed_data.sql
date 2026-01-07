-- =====================================================
-- IMPROVED CLIENT SUPABASE SEED DATA
-- Run this in Supabase SQL Editor
-- This creates realistic time-distributed data for dashboard demo
-- =====================================================

-- =====================================================
-- STEP 1: CLEAR EXISTING DATA (Optional - uncomment if needed)
-- =====================================================
-- TRUNCATE TABLE analytics_events CASCADE;
-- TRUNCATE TABLE orders CASCADE;
-- TRUNCATE TABLE products CASCADE;
-- TRUNCATE TABLE users CASCADE;

-- =====================================================
-- STEP 2: CREATE TABLES (if not exists)
-- =====================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  total DECIMAL(10, 2) NOT NULL CHECK (total >= 0),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products table
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

-- Analytics events table
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  event_name VARCHAR(255) NOT NULL,
  user_id UUID,
  page_url TEXT,
  metadata JSONB DEFAULT '{}',
  session_id VARCHAR(100),
  ip_address VARCHAR(50),
  user_agent TEXT,
  country VARCHAR(100),
  city VARCHAR(100),
  device_type VARCHAR(50),
  browser VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- STEP 3: INSERT USERS (50 users over 90 days)
-- =====================================================

-- Delete existing users first to avoid conflicts
DELETE FROM users WHERE email LIKE '%@example.com' OR email LIKE '%@demo.com';

-- Insert 50 users with staggered registration dates
INSERT INTO users (email, name, status, created_at) VALUES
  -- Week 1-2 (Early adopters)
  ('john.doe@example.com', 'John Doe', 'active', NOW() - INTERVAL '89 days'),
  ('jane.smith@example.com', 'Jane Smith', 'active', NOW() - INTERVAL '88 days'),
  ('bob.johnson@example.com', 'Bob Johnson', 'active', NOW() - INTERVAL '87 days'),
  ('alice.brown@example.com', 'Alice Brown', 'active', NOW() - INTERVAL '85 days'),
  ('charlie.wilson@example.com', 'Charlie Wilson', 'active', NOW() - INTERVAL '84 days'),
  
  -- Week 3-4
  ('diana.prince@demo.com', 'Diana Prince', 'active', NOW() - INTERVAL '80 days'),
  ('edward.norton@demo.com', 'Edward Norton', 'active', NOW() - INTERVAL '78 days'),
  ('fiona.apple@demo.com', 'Fiona Apple', 'active', NOW() - INTERVAL '75 days'),
  ('george.lucas@demo.com', 'George Lucas', 'active', NOW() - INTERVAL '73 days'),
  ('hannah.montana@demo.com', 'Hannah Montana', 'inactive', NOW() - INTERVAL '70 days'),
  
  -- Week 5-6
  ('ivan.petrov@example.com', 'Ivan Petrov', 'active', NOW() - INTERVAL '68 days'),
  ('julia.roberts@example.com', 'Julia Roberts', 'active', NOW() - INTERVAL '65 days'),
  ('kevin.hart@example.com', 'Kevin Hart', 'active', NOW() - INTERVAL '63 days'),
  ('lisa.simpson@example.com', 'Lisa Simpson', 'active', NOW() - INTERVAL '60 days'),
  ('mike.tyson@example.com', 'Mike Tyson', 'suspended', NOW() - INTERVAL '58 days'),
  
  -- Week 7-8
  ('nancy.drew@demo.com', 'Nancy Drew', 'active', NOW() - INTERVAL '55 days'),
  ('oscar.wilde@demo.com', 'Oscar Wilde', 'active', NOW() - INTERVAL '53 days'),
  ('penny.lane@demo.com', 'Penny Lane', 'active', NOW() - INTERVAL '50 days'),
  ('quinn.hughes@demo.com', 'Quinn Hughes', 'active', NOW() - INTERVAL '48 days'),
  ('rachel.green@demo.com', 'Rachel Green', 'active', NOW() - INTERVAL '45 days'),
  
  -- Week 9-10
  ('steve.rogers@example.com', 'Steve Rogers', 'active', NOW() - INTERVAL '43 days'),
  ('tina.turner@example.com', 'Tina Turner', 'active', NOW() - INTERVAL '40 days'),
  ('uma.thurman@example.com', 'Uma Thurman', 'active', NOW() - INTERVAL '38 days'),
  ('victor.hugo@example.com', 'Victor Hugo', 'inactive', NOW() - INTERVAL '35 days'),
  ('wendy.darling@example.com', 'Wendy Darling', 'active', NOW() - INTERVAL '33 days'),
  
  -- Week 11-12
  ('xavier.woods@demo.com', 'Xavier Woods', 'active', NOW() - INTERVAL '30 days'),
  ('yuki.tanaka@demo.com', 'Yuki Tanaka', 'active', NOW() - INTERVAL '28 days'),
  ('zara.phillips@demo.com', 'Zara Phillips', 'active', NOW() - INTERVAL '25 days'),
  ('adam.levine@demo.com', 'Adam Levine', 'active', NOW() - INTERVAL '23 days'),
  ('bella.swan@demo.com', 'Bella Swan', 'active', NOW() - INTERVAL '20 days'),
  
  -- Week 13 (Recent signups - higher activity)
  ('chris.evans@example.com', 'Chris Evans', 'active', NOW() - INTERVAL '18 days'),
  ('demi.moore@example.com', 'Demi Moore', 'active', NOW() - INTERVAL '16 days'),
  ('emma.watson@example.com', 'Emma Watson', 'active', NOW() - INTERVAL '14 days'),
  ('frank.ocean@example.com', 'Frank Ocean', 'active', NOW() - INTERVAL '12 days'),
  ('grace.kelly@example.com', 'Grace Kelly', 'active', NOW() - INTERVAL '10 days'),
  
  -- This week (Very recent)
  ('henry.cavill@demo.com', 'Henry Cavill', 'active', NOW() - INTERVAL '8 days'),
  ('iris.west@demo.com', 'Iris West', 'active', NOW() - INTERVAL '6 days'),
  ('jack.sparrow@demo.com', 'Jack Sparrow', 'active', NOW() - INTERVAL '5 days'),
  ('kate.bishop@demo.com', 'Kate Bishop', 'active', NOW() - INTERVAL '4 days'),
  ('leo.messi@demo.com', 'Leo Messi', 'active', NOW() - INTERVAL '3 days'),
  
  -- Yesterday and today
  ('mary.jane@example.com', 'Mary Jane', 'active', NOW() - INTERVAL '2 days'),
  ('nick.fury@example.com', 'Nick Fury', 'active', NOW() - INTERVAL '1 day'),
  ('olivia.pope@example.com', 'Olivia Pope', 'active', NOW() - INTERVAL '12 hours'),
  ('peter.parker@example.com', 'Peter Parker', 'active', NOW() - INTERVAL '6 hours'),
  ('quinn.fabray@example.com', 'Quinn Fabray', 'active', NOW() - INTERVAL '2 hours')
ON CONFLICT (email) DO UPDATE SET 
  name = EXCLUDED.name,
  status = EXCLUDED.status,
  created_at = EXCLUDED.created_at;

-- =====================================================
-- STEP 4: INSERT PRODUCTS (20 products)
-- =====================================================

DELETE FROM products WHERE name LIKE 'MacBook%' OR name LIKE 'Wireless%' OR category IN ('Electronics', 'Furniture', 'Software', 'Accessories');

INSERT INTO products (name, price, stock, category, description, created_at) VALUES
  -- Electronics
  ('MacBook Pro 16"', 2499.99, 25, 'Electronics', 'High-performance laptop for professionals', NOW() - INTERVAL '90 days'),
  ('MacBook Air M3', 1299.99, 50, 'Electronics', 'Lightweight laptop for everyday use', NOW() - INTERVAL '85 days'),
  ('iPhone 15 Pro', 999.99, 100, 'Electronics', 'Latest flagship smartphone', NOW() - INTERVAL '80 days'),
  ('iPad Pro 12.9"', 1099.99, 40, 'Electronics', 'Professional tablet for creatives', NOW() - INTERVAL '75 days'),
  ('Apple Watch Ultra', 799.99, 60, 'Electronics', 'Premium smartwatch for athletes', NOW() - INTERVAL '70 days'),
  
  -- Accessories
  ('Wireless Mouse', 29.99, 200, 'Accessories', 'Ergonomic wireless mouse', NOW() - INTERVAL '90 days'),
  ('Mechanical Keyboard', 129.99, 150, 'Accessories', 'RGB mechanical keyboard', NOW() - INTERVAL '88 days'),
  ('USB-C Hub', 79.99, 120, 'Accessories', 'Multi-port USB-C hub', NOW() - INTERVAL '85 days'),
  ('Webcam HD 4K', 149.99, 90, 'Accessories', '4K webcam for streaming', NOW() - INTERVAL '80 days'),
  ('Noise Cancelling Headphones', 299.99, 80, 'Accessories', 'Premium ANC headphones', NOW() - INTERVAL '75 days'),
  
  -- Furniture
  ('Standing Desk', 499.99, 30, 'Furniture', 'Electric adjustable standing desk', NOW() - INTERVAL '90 days'),
  ('Ergonomic Chair', 349.99, 45, 'Furniture', 'Comfortable office chair with lumbar support', NOW() - INTERVAL '87 days'),
  ('Monitor Arm', 89.99, 100, 'Furniture', 'Adjustable monitor arm mount', NOW() - INTERVAL '82 days'),
  ('Desk Lamp LED', 49.99, 150, 'Furniture', 'Smart LED desk lamp', NOW() - INTERVAL '78 days'),
  ('Cable Management Kit', 24.99, 200, 'Furniture', 'Complete cable organization solution', NOW() - INTERVAL '73 days'),
  
  -- Software/Services
  ('Cloud Storage 1TB', 99.99, 999, 'Software', 'Annual cloud storage subscription', NOW() - INTERVAL '90 days'),
  ('VPN Premium', 59.99, 999, 'Software', 'Annual VPN subscription', NOW() - INTERVAL '85 days'),
  ('Password Manager', 39.99, 999, 'Software', 'Annual password manager subscription', NOW() - INTERVAL '80 days'),
  ('Antivirus Suite', 79.99, 999, 'Software', 'Complete security suite', NOW() - INTERVAL '75 days'),
  ('Productivity Suite', 149.99, 999, 'Software', 'Office productivity bundle', NOW() - INTERVAL '70 days')
ON CONFLICT DO NOTHING;

-- =====================================================
-- STEP 5: INSERT ORDERS (500+ orders over 90 days)
-- Time-distributed with realistic patterns
-- =====================================================

-- Clear existing orders
DELETE FROM orders;

-- Generate orders with time distribution
-- Pattern: More orders on recent days, weekend dips, gradual growth
DO $$
DECLARE
  user_record RECORD;
  order_date TIMESTAMPTZ;
  order_total DECIMAL(10,2);
  order_status TEXT;
  order_count INTEGER;
  day_offset INTEGER;
  hour_offset INTEGER;
  status_rand FLOAT;
BEGIN
  -- Loop through each day in the last 90 days
  FOR day_offset IN 0..89 LOOP
    -- Calculate how many orders for this day (more recent = more orders)
    -- Base: 2-4 orders per day, increasing to 8-15 for recent days
    IF day_offset < 7 THEN
      order_count := floor(random() * 8 + 8)::INTEGER; -- 8-15 orders
    ELSIF day_offset < 14 THEN
      order_count := floor(random() * 6 + 6)::INTEGER; -- 6-11 orders
    ELSIF day_offset < 30 THEN
      order_count := floor(random() * 5 + 4)::INTEGER; -- 4-8 orders
    ELSIF day_offset < 60 THEN
      order_count := floor(random() * 4 + 3)::INTEGER; -- 3-6 orders
    ELSE
      order_count := floor(random() * 3 + 2)::INTEGER; -- 2-4 orders
    END IF;
    
    -- Weekend reduction (Saturday = 0, Sunday = 1 when using EXTRACT DOW)
    IF EXTRACT(DOW FROM (NOW() - (day_offset || ' days')::INTERVAL)) IN (0, 6) THEN
      order_count := GREATEST(1, order_count - 2);
    END IF;
    
    -- Create orders for this day
    FOR i IN 1..order_count LOOP
      -- Pick a random user
      SELECT * INTO user_record FROM users ORDER BY random() LIMIT 1;
      
      -- Random hour of day (business hours more likely)
      hour_offset := CASE 
        WHEN random() < 0.7 THEN floor(random() * 10 + 9)::INTEGER -- 9 AM - 7 PM
        ELSE floor(random() * 24)::INTEGER
      END;
      
      order_date := (NOW() - (day_offset || ' days')::INTERVAL)::DATE + (hour_offset || ' hours')::INTERVAL + (floor(random() * 60) || ' minutes')::INTERVAL;
      
      -- Random order total (weighted towards medium orders)
      order_total := CASE 
        WHEN random() < 0.1 THEN (random() * 50 + 20)::DECIMAL(10,2)  -- Small: $20-70
        WHEN random() < 0.6 THEN (random() * 200 + 50)::DECIMAL(10,2) -- Medium: $50-250
        WHEN random() < 0.9 THEN (random() * 500 + 200)::DECIMAL(10,2) -- Large: $200-700
        ELSE (random() * 2000 + 500)::DECIMAL(10,2) -- Premium: $500-2500
      END;
      
      -- Status based on age (older orders more likely completed)
      status_rand := random();
      IF day_offset > 14 THEN
        order_status := CASE WHEN status_rand < 0.85 THEN 'completed' WHEN status_rand < 0.92 THEN 'cancelled' ELSE 'processing' END;
      ELSIF day_offset > 3 THEN
        order_status := CASE WHEN status_rand < 0.6 THEN 'completed' WHEN status_rand < 0.8 THEN 'processing' WHEN status_rand < 0.9 THEN 'pending' ELSE 'cancelled' END;
      ELSE
        order_status := CASE WHEN status_rand < 0.2 THEN 'completed' WHEN status_rand < 0.5 THEN 'processing' WHEN status_rand < 0.85 THEN 'pending' ELSE 'cancelled' END;
      END IF;
      
      INSERT INTO orders (user_id, total, status, created_at, updated_at)
      VALUES (user_record.id, order_total, order_status, order_date, order_date + INTERVAL '1 hour');
    END LOOP;
  END LOOP;
END $$;

-- =====================================================
-- STEP 6: INSERT ANALYTICS EVENTS (2000+ events over 90 days)
-- =====================================================

-- Clear existing events
DELETE FROM analytics_events;

-- Create analytics events with realistic distribution
DO $$
DECLARE
  event_date TIMESTAMPTZ;
  event_count INTEGER;
  day_offset INTEGER;
  session_num INTEGER := 1;
  countries TEXT[] := ARRAY['Malaysia', 'Singapore', 'Thailand', 'Indonesia', 'Philippines', 'Vietnam', 'Japan', 'South Korea', 'Australia', 'United States', 'United Kingdom', 'Germany'];
  cities TEXT[] := ARRAY['Kuala Lumpur', 'Singapore', 'Bangkok', 'Jakarta', 'Manila', 'Ho Chi Minh', 'Tokyo', 'Seoul', 'Sydney', 'New York', 'London', 'Berlin'];
  devices TEXT[] := ARRAY['desktop', 'mobile', 'tablet'];
  browsers TEXT[] := ARRAY['Chrome', 'Safari', 'Firefox', 'Edge', 'Opera'];
  pages TEXT[] := ARRAY['/home', '/products', '/products/detail', '/cart', '/checkout', '/about', '/contact', '/blog', '/pricing', '/login', '/signup', '/dashboard'];
  event_types TEXT[] := ARRAY['page_view', 'click', 'scroll', 'form_submit', 'conversion', 'error'];
  country_idx INTEGER;
  device_idx INTEGER;
  browser_idx INTEGER;
BEGIN
  FOR day_offset IN 0..89 LOOP
    -- More traffic on recent days
    IF day_offset < 7 THEN
      event_count := floor(random() * 40 + 30)::INTEGER; -- 30-70 events
    ELSIF day_offset < 30 THEN
      event_count := floor(random() * 30 + 20)::INTEGER; -- 20-50 events
    ELSE
      event_count := floor(random() * 20 + 10)::INTEGER; -- 10-30 events
    END IF;
    
    FOR i IN 1..event_count LOOP
      event_date := (NOW() - (day_offset || ' days')::INTERVAL)::DATE + (floor(random() * 24) || ' hours')::INTERVAL + (floor(random() * 60) || ' minutes')::INTERVAL;
      country_idx := floor(random() * array_length(countries, 1) + 1)::INTEGER;
      device_idx := floor(random() * array_length(devices, 1) + 1)::INTEGER;
      browser_idx := floor(random() * array_length(browsers, 1) + 1)::INTEGER;
      
      INSERT INTO analytics_events (
        event_type, 
        event_name, 
        page_url, 
        session_id,
        country, 
        city, 
        device_type, 
        browser,
        metadata,
        created_at
      ) VALUES (
        event_types[floor(random() * array_length(event_types, 1) + 1)::INTEGER],
        CASE floor(random() * 10)::INTEGER
          WHEN 0 THEN 'Homepage Visit'
          WHEN 1 THEN 'Product View'
          WHEN 2 THEN 'Add to Cart'
          WHEN 3 THEN 'Remove from Cart'
          WHEN 4 THEN 'Checkout Started'
          WHEN 5 THEN 'Purchase Complete'
          WHEN 6 THEN 'Search Query'
          WHEN 7 THEN 'Newsletter Signup'
          WHEN 8 THEN 'Contact Form Submit'
          ELSE 'Page Scroll'
        END,
        pages[floor(random() * array_length(pages, 1) + 1)::INTEGER],
        'sess_' || (session_num + floor(random() * 1000)::INTEGER)::TEXT,
        countries[country_idx],
        cities[country_idx],
        devices[device_idx],
        browsers[browser_idx],
        jsonb_build_object(
          'referrer', CASE floor(random() * 5)::INTEGER 
            WHEN 0 THEN 'google.com' 
            WHEN 1 THEN 'facebook.com' 
            WHEN 2 THEN 'twitter.com' 
            WHEN 3 THEN 'direct' 
            ELSE 'linkedin.com' 
          END,
          'duration_ms', floor(random() * 30000 + 1000)::INTEGER
        ),
        event_date
      );
      
      session_num := session_num + 1;
    END LOOP;
  END LOOP;
END $$;

-- =====================================================
-- STEP 7: CREATE INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_total ON orders(total);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);

CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_country ON analytics_events(country);
CREATE INDEX IF NOT EXISTS idx_analytics_device ON analytics_events(device_type);

-- =====================================================
-- STEP 8: VERIFY DATA
-- =====================================================

-- Summary statistics
SELECT '========== DATA SUMMARY ==========' as info;

SELECT 
  'users' as table_name,
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE status = 'active') as active_count,
  MIN(created_at)::DATE as earliest,
  MAX(created_at)::DATE as latest
FROM users;

SELECT 
  'orders' as table_name,
  COUNT(*) as total_rows,
  ROUND(SUM(total)::NUMERIC, 2) as total_revenue,
  ROUND(AVG(total)::NUMERIC, 2) as avg_order_value,
  MIN(created_at)::DATE as earliest,
  MAX(created_at)::DATE as latest
FROM orders;

SELECT 
  'products' as table_name,
  COUNT(*) as total_rows,
  COUNT(DISTINCT category) as categories,
  MIN(created_at)::DATE as earliest,
  MAX(created_at)::DATE as latest
FROM products;

SELECT 
  'analytics_events' as table_name,
  COUNT(*) as total_rows,
  COUNT(DISTINCT session_id) as unique_sessions,
  MIN(created_at)::DATE as earliest,
  MAX(created_at)::DATE as latest
FROM analytics_events;

-- Daily order trends (last 14 days)
SELECT '========== DAILY ORDERS (Last 14 Days) ==========' as info;
SELECT 
  created_at::DATE as order_date,
  COUNT(*) as order_count,
  ROUND(SUM(total)::NUMERIC, 2) as daily_revenue
FROM orders 
WHERE created_at > NOW() - INTERVAL '14 days'
GROUP BY created_at::DATE
ORDER BY order_date DESC;

-- Order status breakdown
SELECT '========== ORDER STATUS ==========' as info;
SELECT 
  status,
  COUNT(*) as count,
  ROUND((COUNT(*) * 100.0 / (SELECT COUNT(*) FROM orders))::NUMERIC, 1) as percentage
FROM orders
GROUP BY status
ORDER BY count DESC;

-- Top countries by events
SELECT '========== TOP COUNTRIES ==========' as info;
SELECT 
  country,
  COUNT(*) as events,
  COUNT(DISTINCT session_id) as sessions
FROM analytics_events
GROUP BY country
ORDER BY events DESC
LIMIT 10;

-- Event type breakdown
SELECT '========== EVENT TYPES ==========' as info;
SELECT 
  event_type,
  COUNT(*) as count
FROM analytics_events
GROUP BY event_type
ORDER BY count DESC;

