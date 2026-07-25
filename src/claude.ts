import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, Tool } from "@anthropic-ai/sdk/resources/messages";
import { addTask, completeTask, deleteTask, listTasks } from "./tools/tasks.js";
import { createEvent, listUpcomingEvents } from "./tools/calendar.js";
import { createDraftEmail, listRecentEmails } from "./tools/gmail.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-5";

const tools: Tool[] = [
  {
    name: "add_task",
    description: "ユーザーのToDoリストに新しいタスクを追加する",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "タスクの内容" },
        due_at: {
          type: "string",
          description: "期限のISO8601日時（任意、例: 2026-07-26T18:00:00+09:00）",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "list_tasks",
    description: "ユーザーのToDoリストを取得する",
    input_schema: {
      type: "object",
      properties: {
        include_done: {
          type: "boolean",
          description: "完了済みタスクも含めるか（デフォルトfalse）",
        },
      },
    },
  },
  {
    name: "complete_task",
    description: "指定したIDのタスクを完了にする",
    input_schema: {
      type: "object",
      properties: { task_id: { type: "integer" } },
      required: ["task_id"],
    },
  },
  {
    name: "delete_task",
    description: "指定したIDのタスクを削除する",
    input_schema: {
      type: "object",
      properties: { task_id: { type: "integer" } },
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
      return addTask(userId, input.title, input.due_at);
    case "list_tasks":
      return listTasks(userId, Boolean(input.include_done));
    case "complete_task":
      return completeTask(userId, input.task_id);
    case "delete_task":
      return { deleted: deleteTask(userId, input.task_id) };
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
  ].join("\n");
}

export async function chat(
  userId: string,
  history: MessageParam[]
): Promise<{ reply: string; history: MessageParam[] }> {
  const messages: MessageParam[] = [...history];

  for (let turn = 0; turn < 6; turn++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
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
