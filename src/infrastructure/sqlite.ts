import Database from "better-sqlite3";

export type SqliteDatabase = Database.Database;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS competitors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  website TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  competitor_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('website', 'pricing', 'blog', 'github', 'rss')),
  url TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (competitor_id) REFERENCES competitors(id) ON DELETE CASCADE,
  UNIQUE (competitor_id, url)
);

CREATE INDEX IF NOT EXISTS idx_sources_competitor_id
  ON sources(competitor_id);

CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_snapshots_source_fetched_at
  ON snapshots(source_id, fetched_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS changes (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  previous_snapshot_id TEXT NOT NULL,
  current_snapshot_id TEXT NOT NULL UNIQUE,
  diff TEXT NOT NULL,
  detected_at TEXT NOT NULL,
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
  FOREIGN KEY (previous_snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
  FOREIGN KEY (current_snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
  CHECK (previous_snapshot_id <> current_snapshot_id)
);

CREATE INDEX IF NOT EXISTS idx_changes_source_detected_at
  ON changes(source_id, detected_at, id);

CREATE TABLE IF NOT EXISTS findings (
  id TEXT PRIMARY KEY,
  competitor_id TEXT NOT NULL,
  change_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (
    type IN ('pricing_change', 'product_launch', 'positioning_change', 'content_change', 'other')
  ),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  summary TEXT NOT NULL,
  impact TEXT NOT NULL,
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  created_at TEXT NOT NULL,
  FOREIGN KEY (competitor_id) REFERENCES competitors(id) ON DELETE CASCADE,
  FOREIGN KEY (change_id) REFERENCES changes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_findings_competitor_created_at
  ON findings(competitor_id, created_at, id);
`;

export function openSqliteDatabase(path = "marketops.db"): SqliteDatabase {
  const database = new Database(path);
  database.pragma("foreign_keys = ON");
  database.pragma("journal_mode = WAL");
  return database;
}

export function initializeSqliteDatabase(database: SqliteDatabase): void {
  database.exec(SCHEMA);
}
