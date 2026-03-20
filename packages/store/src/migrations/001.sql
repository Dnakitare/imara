CREATE TABLE IF NOT EXISTS events (
  id              TEXT PRIMARY KEY,
  timestamp       TEXT NOT NULL,
  session_id      TEXT,
  server_name     TEXT,
  agent_id        TEXT,
  tool_name       TEXT NOT NULL,
  tool_arguments  TEXT NOT NULL,
  tool_annotations TEXT,
  policy_decision TEXT NOT NULL DEFAULT 'allow',
  policy_reason   TEXT,
  policies_evaluated TEXT,
  result_status   TEXT,
  result_summary  TEXT,
  result_latency_ms INTEGER,
  prev_hash       TEXT,
  event_hash      TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_tool ON events(tool_name);
CREATE INDEX IF NOT EXISTS idx_events_decision ON events(policy_decision);
