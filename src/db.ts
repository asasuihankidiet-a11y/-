import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const dbPath = process.env.DB_PATH ?? "./data.sqlite";
mkdirSync(dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    due_at TEXT,
    done INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const taskColumns = db.prepare("PRAGMA table_info(tasks)").all() as { name: string }[];
if (!taskColumns.some((c) => c.name === "category")) {
  db.exec("ALTER TABLE tasks ADD COLUMN category TEXT");
}
