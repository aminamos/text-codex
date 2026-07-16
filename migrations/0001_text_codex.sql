CREATE TABLE IF NOT EXISTS user_numbers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  phone_number TEXT NOT NULL UNIQUE,
  source_number TEXT NOT NULL,
  created_at TEXT NOT NULL,
  released_at TEXT
);
CREATE TABLE IF NOT EXISTS agent_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  token_ciphertext TEXT NOT NULL,
  token_iv TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('inbound','outbound')),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_user_numbers_user ON user_numbers(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_created ON messages(user_id, created_at DESC);
