-- Users table
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Queue table
CREATE TABLE IF NOT EXISTS queue (
  id BIGSERIAL PRIMARY KEY,
  position INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id BIGINT NOT NULL,
  charger_id INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'charging', 'overtime')),
  duration_minutes INTEGER,
  charging_started_at TIMESTAMP WITH TIME ZONE,
  estimated_end_time TIMESTAMP WITH TIME ZONE
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_queue_charger_status ON queue(charger_id, status);
CREATE INDEX IF NOT EXISTS idx_queue_user_status ON queue(user_id, status);
CREATE INDEX IF NOT EXISTS idx_queue_position ON queue(charger_id, position, status);

-- RLS (Row Level Security) policies can be added here if needed
-- For now, we'll use the service role key for admin operations
