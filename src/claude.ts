import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, Tool } from "@anthropic-ai/sdk/resources/messages";
import {
  addTask,
  completeTask,
  deleteTask,
  listTasks,
  updateTask,
} from "./tools/google-tasks.js";
import { createEvent, listUpcomingEvents } from "./tools/calendar.js";
import { createDraftEmail, listRecentEmails } from "./tools/gmail.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-5";

const tools: Tool[] = [
  {
    name: "add_task",
    description:
      "ユーザーのToDoリスト（Google Tasks、「AI秘書」というリスト）に新しいタスクを追加する",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "タスクの内容" },
        category: {
          type: "string",
          description:
            "タスクの分野・カテゴリ（任意、例: 自己理解講座, 子ども, 仕事）。会話の文脈から適切なものを推測して設定する",
        },
        due_at: {
          type: "string",
          description:
            "期限の日付（任意、ISO8601形式、例: 2026-07-30）。Google Tasksでは日付のみが表示される",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "list_tasks",
    description: "ユーザーのToDoリスト（Google Tasks）を取得する",
    input_schema: {
      type: "object",
      properties: {
        include_done: {
          type: "boolean",
          description: "完了済みタスクも含めるか（デフォルトfalse）",
        },
        category: {
          type: "string",
          description: "指定したカテゴリのタスクだけに絞り込む（任意）",
        },
      },
    },
  },
  {
    name: "update_task",
    description:
      "既存タスクのタイトル・カテゴリ・期限を変更する。カテゴリ分けをやり直す等、内容を編集したいときはこれを使う（削除して作り直す必要はない）",
    input_schema: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "Google TasksのタスクID" },
        title: {
          type: "string",
          description: "新しいタスク内容（変更する場合のみ指定）",
        },
        category: {
          type: "string",
          description: "新しいカテゴリ（変更する場合のみ指定）",
        },
        due_at: {
          type: "string",
          description: "新しい期限の日付（ISO8601、変更する場合のみ指定）",
        },
      },
      required: ["task_id"],
    },
  },
  {
    name: "complete_task",
    description: "指定したIDのタスクを完了にする",
    input_schema: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "Google TasksのタスクID" },
      },
      required: ["task_id"],
    },
  },
  {
    name: "delete_task",
    description: "指定したIDのタスクを削除する",
    input_schema: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "Google TasksのタスクID" },
      },
      required: ["task_id"],
    },
  },
  {
    name: "list_calendar_events",
    description: "Googleカレンダーの直近の予定を取得する",
    input_schema: {
      type: "object",
      properties: {
        max_results: { type: "integer", description: "取得件数（デフォルト10）" },
      },
    },
  },
  {
    name: "create_calendar_event",
    description: "Googleカレンダーに新しい予定を作成する",
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "予定のタイトル" },
        start_iso: { type: "string", description: "開始日時（ISO8601、タイムゾーン付き）" },
        end_iso: { type: "string", description: "終了日時（ISO8601、タイムゾーン付き）" },
        description: { type: "string", description: "予定の詳細（任意）" },
      },
      required: ["summary", "start_iso", "end_iso"],
    },
  },
  {
    name: "list_recent_emails",
    description: "Gmail受信トレイの最近のメール一覧（差出人・件名・要約）を取得する",
    input_schema: {
      type: "object",
      properties: {
        max_results: { type: "integer", description: "取得件数（デフォルト5）" },
      },
    },
  },
  {
    name: "create_draft_email",
    description:
      "Gmailに返信・新規メールの下書きを作成する（自動送信はしない。ユーザーが後でGmail上で確認・送信する）",
    input_schema: {
      type: "object",
      properties: {
        to: { type: "string" },
        subject: { type: "string" },
        body: { type: "string" },
      },
      required: ["to", "subject", "body"],
    },
  },
];

async function runTool(userId: string, name: string, input: any): Promise<unknown> {
  switch (name) {
    case "add_task":
      return addTask(input.title, input.category, input.due_at);
    case "list_tasks":
      return listTasks(Boolean(input.include_done), input.category);
    case "update_task":
      return updateTask(input.task_id, {
        title: input.title,
        category: input.category,
        due: input.due_at,
      });
    case "complete_task":
      return completeTask(input.task_id);
    case "delete_task":
      await deleteTask(input.task_id);
      return { deleted: true };
    case "list_calendar_events":
      return listUpcomingEvents(input.max_results ?? 10);
    case "create_calendar_event":
      return createEvent({
        summary: input.summary,
        startIso: input.start_iso,
        endIso: input.end_iso,
        description: input.description,
      });
    case "list_recent_emails":
      return listRecentEmails(input.max_results ?? 5);
    case "create_draft_email":
      return createDraftEmail({
        to: input.to,
        subject: input.subject,
        body: input.body,
      });
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function systemPrompt(): string {
  const now = new Date().toISOString();
  return [
    "あなたはDiscord上で動く優秀なAI秘書です。",
    "ユーザーのタスク管理・スケジュール管理・メール対応の補助・雑談に、簡潔で親しみやすい日本語で応答してください。",
    `現在日時（UTC）: ${now}`,
    "日時をツールに渡す際は、ユーザーの発言から合理的に解釈し、ISO8601形式（タイムゾーン付き）で指定してください。",
    "メールは下書き作成のみ行い、絶対に自動送信しないでください。",
    "カレンダーやメールの操作を行う前に、影響が大きい場合（予定の追加など）は簡潔に確認しても構いませんが、単純な確認・一覧取得は即座に実行してください。",
    "タスクを追加するときは、会話の内容から分野が読み取れる場合（自己理解講座の宿題、子どもの提出物、仕事関連など）、categoryにその分野名を設定してください。",
    "既存タスクのカテゴリ・タイトル・期限を変更したいときは、必ずupdate_taskを使ってください。delete_taskしてadd_taskで作り直す、という遠回りは絶対にしないでください。",
    "複数件のタスクをまとめて更新する場合も、1件ずつupdate_taskを呼び出せば十分です。",
  ].join("\n");
}

export async function chat(
  userId: string,
  history: MessageParam[]
): Promise<{ reply: string; history: MessageParam[] }> {
  const messages: MessageParam[] = [...history];

  for (let turn = 0; turn < 10; turn++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt(),
      tools,
      messages,
    });

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason !== "tool_use") {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      return { reply: text || "(応答がありませんでした)", history: messages };
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      try {
        const result = await runTool(userId, block.name, block.input);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      } catch (err) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: `エラー: ${(err as Error).message}`,
          is_error: true,
        });
      }
    }
    messages.push({ role: "user", content: toolResults });
  }

  return {
    reply: "処理が複雑すぎたため完了できませんでした。もう一度お試しください。",
    history: messages,
  };
}
