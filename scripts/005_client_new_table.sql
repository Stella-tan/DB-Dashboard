-- =====================================================
-- New Table for Client Supabase Database
-- Run this in Supabase SQL Editor
-- =====================================================

-- Create analytics_events table
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

-- Insert sample analytics data
INSERT INTO analytics_events (event_type, event_name, user_id, page_url, metadata, session_id, country, city, device_type, browser) VALUES
  ('page_view', 'Homepage Visit', NULL, '/home', '{"referrer": "google.com"}', 'sess_001', 'Malaysia', 'Kuala Lumpur', 'desktop', 'Chrome'),
  ('page_view', 'Product Page', NULL, '/products/123', '{"product_id": "123"}', 'sess_001', 'Malaysia', 'Kuala Lumpur', 'desktop', 'Chrome'),
  ('click', 'Add to Cart', NULL, '/products/123', '{"product_id": "123", "quantity": 1}', 'sess_001', 'Malaysia', 'Kuala Lumpur', 'desktop', 'Chrome'),
  ('page_view', 'Checkout', NULL, '/checkout', '{"cart_total": 299.99}', 'sess_001', 'Malaysia', 'Kuala Lumpur', 'desktop', 'Chrome'),
  ('conversion', 'Purchase Complete', NULL, '/thank-you', '{"order_id": "ORD-001", "amount": 299.99}', 'sess_001', 'Malaysia', 'Kuala Lumpur', 'desktop', 'Chrome'),
  
  ('page_view', 'Homepage Visit', NULL, '/home', '{"referrer": "facebook.com"}', 'sess_002', 'Singapore', 'Singapore', 'mobile', 'Safari'),
  ('page_view', 'About Page', NULL, '/about', '{}', 'sess_002', 'Singapore', 'Singapore', 'mobile', 'Safari'),
  ('click', 'Contact Us', NULL, '/about', '{"element": "contact_button"}', 'sess_002', 'Singapore', 'Singapore', 'mobile', 'Safari'),
  
  ('page_view', 'Homepage Visit', NULL, '/home', '{"referrer": "direct"}', 'sess_003', 'Thailand', 'Bangkok', 'tablet', 'Firefox'),
  ('page_view', 'Blog Post', NULL, '/blog/how-to-guide', '{"post_id": "456"}', 'sess_003', 'Thailand', 'Bangkok', 'tablet', 'Firefox'),
  ('click', 'Subscribe Newsletter', NULL, '/blog/how-to-guide', '{"email": "user@example.com"}', 'sess_003', 'Thailand', 'Bangkok', 'tablet', 'Firefox'),
  
  ('page_view', 'Homepage Visit', NULL, '/home', '{}', 'sess_004', 'Indonesia', 'Jakarta', 'desktop', 'Edge'),
  ('page_view', 'Products List', NULL, '/products', '{"category": "electronics"}', 'sess_004', 'Indonesia', 'Jakarta', 'desktop', 'Edge'),
  ('page_view', 'Product Detail', NULL, '/products/789', '{"product_id": "789"}', 'sess_004', 'Indonesia', 'Jakarta', 'desktop', 'Edge'),
  ('click', 'Add to Wishlist', NULL, '/products/789', '{"product_id": "789"}', 'sess_004', 'Indonesia', 'Jakarta', 'desktop', 'Edge'),
  
  ('page_view', 'Homepage Visit', NULL, '/home', '{"referrer": "twitter.com"}', 'sess_005', 'Philippines', 'Manila', 'mobile', 'Chrome'),
  ('page_view', 'Pricing Page', NULL, '/pricing', '{}', 'sess_005', 'Philippines', 'Manila', 'mobile', 'Chrome'),
  ('click', 'Start Free Trial', NULL, '/pricing', '{"plan": "pro"}', 'sess_005', 'Philippines', 'Manila', 'mobile', 'Chrome'),
  ('conversion', 'Trial Started', NULL, '/onboarding', '{"plan": "pro", "trial_days": 14}', 'sess_005', 'Philippines', 'Manila', 'mobile', 'Chrome'),
  
  ('page_view', 'Homepage Visit', NULL, '/home', '{}', 'sess_006', 'Vietnam', 'Ho Chi Minh', 'desktop', 'Chrome'),
  ('error', 'Page Not Found', NULL, '/invalid-page', '{"status_code": 404}', 'sess_006', 'Vietnam', 'Ho Chi Minh', 'desktop', 'Chrome'),
  ('page_view', 'Homepage Visit', NULL, '/home', '{}', 'sess_006', 'Vietnam', 'Ho Chi Minh', 'desktop', 'Chrome'),
  
  ('page_view', 'Login Page', NULL, '/login', '{}', 'sess_007', 'Japan', 'Tokyo', 'desktop', 'Safari'),
  ('auth', 'Login Success', NULL, '/dashboard', '{"method": "email"}', 'sess_007', 'Japan', 'Tokyo', 'desktop', 'Safari'),
  ('page_view', 'Dashboard', NULL, '/dashboard', '{}', 'sess_007', 'Japan', 'Tokyo', 'desktop', 'Safari');

-- Verify data
SELECT 
  event_type,
  COUNT(*) as count 
FROM analytics_events 
GROUP BY event_type 
ORDER BY count DESC;

SELECT 
  country,
  COUNT(*) as events 
FROM analytics_events 
GROUP BY country 
ORDER BY events DESC;

