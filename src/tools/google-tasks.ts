import { google, tasks_v1 } from "googleapis";
import { getGoogleAuth } from "../google-auth.js";

const TASKLIST_TITLE = "AI秘書";
let cachedTaskListId: string | null = null;

function tasksClient(): tasks_v1.Tasks {
  const auth = getGoogleAuth();
  if (!auth) {
    throw new Error(
      "Google連携が未設定です。GOOGLE_CLIENT_ID等を.envに設定し、npm run google-authを実行してください。"
    );
  }
  return google.tasks({ version: "v1", auth });
}

async function getTaskListId(): Promise<string> {
  if (cachedTaskListId) return cachedTaskListId;

  const tasks = tasksClient();
  const { data } = await tasks.tasklists.list({ maxResults: 100 });
  const existing = data.items?.find((t) => t.title === TASKLIST_TITLE);
  if (existing?.id) {
    cachedTaskListId = existing.id;
    return existing.id;
  }

  const { data: created } = await tasks.tasklists.insert({
    requestBody: { title: TASKLIST_TITLE },
  });
  cachedTaskListId = created.id!;
  return cachedTaskListId;
}

function formatTitle(title: string, category?: string): string {
  return category ? `[${category}] ${title}` : title;
}

function parseTitle(raw: string): { category: string | null; title: string } {
  const match = raw.match(/^\[(.+?)\]\s*(.*)$/);
  if (match) return { category: match[1], title: match[2] };
  return { category: null, title: raw };
}

export interface GoogleTask {
  id: string;
  title: string;
  category: string | null;
  due: string | null;
  done: boolean;
}

function toGoogleTask(data: tasks_v1.Schema$Task): GoogleTask {
  const { category, title } = parseTitle(data.title ?? "");
  return {
    id: data.id!,
    title,
    category,
    due: data.due ?? null,
    done: data.status === "completed",
  };
}

export async function addTask(
  title: string,
  category?: string,
  due?: string
): Promise<GoogleTask> {
  const tasks = tasksClient();
  const tasklist = await getTaskListId();
  const { data } = await tasks.tasks.insert({
    tasklist,
    requestBody: {
      title: formatTitle(title, category),
      due: due ? new Date(due).toISOString() : undefined,
    },
  });
  return toGoogleTask(data);
}

export async function listTasks(
  includeDone = false,
  category?: string
): Promise<GoogleTask[]> {
  const tasks = tasksClient();
  const tasklist = await getTaskListId();
  const { data } = await tasks.tasks.list({
    tasklist,
    showCompleted: includeDone,
    showHidden: includeDone,
    maxResults: 100,
  });
  let items = (data.items ?? []).map(toGoogleTask);
  if (category) items = items.filter((t) => t.category === category);
  return items;
}

export async function completeTask(taskId: string): Promise<GoogleTask> {
  const tasks = tasksClient();
  const tasklist = await getTaskListId();
  const { data } = await tasks.tasks.patch({
    tasklist,
    task: taskId,
    requestBody: { status: "completed" },
  });
  return toGoogleTask(data);
}

export async function deleteTask(taskId: string): Promise<void> {
  const tasks = tasksClient();
  const tasklist = await getTaskListId();
  await tasks.tasks.delete({ tasklist, task: taskId });
}
