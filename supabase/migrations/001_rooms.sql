-- Rooms table for storing interview room data
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  daily_room_url TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Index for faster lookups by name
CREATE INDEX IF NOT EXISTS idx_rooms_name ON rooms(name);

-- Index for finding expired rooms
CREATE INDEX IF NOT EXISTS idx_rooms_expires_at ON rooms(expires_at);

-- Enable Row Level Security
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

-- Policy to allow all operations (can be tightened based on requirements)
CREATE POLICY "Enable all operations for rooms" ON rooms
  FOR ALL
  USING (true)
  WITH CHECK (true);
