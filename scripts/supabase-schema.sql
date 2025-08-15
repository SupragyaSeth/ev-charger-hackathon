-- Create the users table (equivalent to your Prisma User model)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create the queue table (equivalent to your Prisma Queue model)
CREATE TABLE queue (
  id SERIAL PRIMARY KEY,
  position INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id INTEGER NOT NULL,
  charger_id INTEGER NOT NULL,
  status VARCHAR(50) DEFAULT 'waiting' CHECK (status IN ('waiting', 'charging', 'overtime')),
  duration_minutes INTEGER,
  charging_started_at TIMESTAMP WITH TIME ZONE,
  estimated_end_time TIMESTAMP WITH TIME ZONE
);

-- Create password_reset_tokens table for forgot password system
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(token_hash)
);

-- Create indexes for better performance
CREATE INDEX idx_queue_charger_id ON queue(charger_id);
CREATE INDEX idx_queue_user_id ON queue(user_id);
CREATE INDEX idx_queue_status ON queue(status);
CREATE INDEX idx_queue_position ON queue(position);
CREATE INDEX idx_queue_charger_position ON queue(charger_id, position);
CREATE INDEX IF NOT EXISTS idx_password_reset_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_expires_at ON password_reset_tokens(expires_at);

-- Add Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue ENABLE ROW LEVEL SECURITY;

-- Policy for users table - users can only see their own data
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid()::text = id::text);

-- Policy for queue table - users can see all queue entries (for transparency)
CREATE POLICY "Everyone can view queue" ON queue FOR SELECT TO authenticated USING (true);

-- Policy for queue table - users can only modify their own entries
CREATE POLICY "Users can insert own queue entries" ON queue
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own queue entries" ON queue
  FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own queue entries" ON queue
  FOR DELETE USING (auth.uid()::text = user_id::text);

-- Service role can do everything (for admin operations)
CREATE POLICY "Service role can manage users" ON users
  USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

CREATE POLICY "Service role can manage queue" ON queue
  USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');
