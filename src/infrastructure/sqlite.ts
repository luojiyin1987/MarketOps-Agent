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
