import Database from "better-sqlite3";

export type SqliteDatabase = Database.Database;

export function openSqliteDatabase(path = "marketops.db"): SqliteDatabase {
  const database = new Database(path);
  database.pragma("foreign_keys = ON");
  database.pragma("journal_mode = WAL");
  return database;
}
