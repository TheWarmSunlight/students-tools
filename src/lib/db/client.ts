import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "./schema";

export type AppDatabase = Database.Database;

export function openDatabase(path = process.env.DATABASE_PATH || "./data/app.db"): AppDatabase {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }

  const db = new Database(path);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA_SQL);
  return db;
}
