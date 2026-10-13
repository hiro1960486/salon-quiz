CREATE TABLE IF NOT EXISTS sessions (
 id TEXT PRIMARY KEY,
 genre TEXT NOT NULL,
 question_count INTEGER NOT NULL,
 question_ids TEXT NOT NULL,
 answer_keys TEXT NOT NULL,
 started_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 used INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS scores (
 id TEXT PRIMARY KEY,
 genre TEXT NOT NULL,
 question_count INTEGER NOT NULL,
 correct INTEGER NOT NULL,
 duration_ms INTEGER NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS scores_rank ON scores(genre,question_count,correct DESC,duration_ms ASC);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
