import { db } from "../db.js";

export interface Task {
  id: number;
  user_id: string;
  title: string;
  category: string | null;
  due_at: string | null;
  done: number;
  created_at: string;
}

export function addTask(
  userId: string,
  title: string,
  category?: string,
  dueAt?: string
): Task {
  const stmt = db.prepare(
    "INSERT INTO tasks (user_id, title, category, due_at) VALUES (?, ?, ?, ?)"
  );
  const info = stmt.run(userId, title, category ?? null, dueAt ?? null);
  return db
    .prepare("SELECT * FROM tasks WHERE id = ?")
    .get(info.lastInsertRowid) as Task;
}

export function listTasks(
  userId: string,
  includeDone = false,
  category?: string
): Task[] {
  const conditions = ["user_id = ?"];
  const params: (string | number)[] = [userId];
  if (!includeDone) conditions.push("done = 0");
  if (category) {
    conditions.push("category = ?");
    params.push(category);
  }
  const query = `SELECT * FROM tasks WHERE ${conditions.join(
    " AND "
  )} ORDER BY done ASC, due_at IS NULL, due_at ASC, id ASC`;
  return db.prepare(query).all(...params) as Task[];
}

export function completeTask(userId: string, taskId: number): Task | null {
  db.prepare(
    "UPDATE tasks SET done = 1 WHERE id = ? AND user_id = ?"
  ).run(taskId, userId);
  return (
    (db
      .prepare("SELECT * FROM tasks WHERE id = ? AND user_id = ?")
      .get(taskId, userId) as Task | undefined) ?? null
  );
}

export function deleteTask(userId: string, taskId: number): boolean {
  const info = db
    .prepare("DELETE FROM tasks WHERE id = ? AND user_id = ?")
    .run(taskId, userId);
  return info.changes > 0;
}
