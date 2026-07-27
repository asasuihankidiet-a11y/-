import "dotenv/config";
import { Client, GatewayIntentBits, Partials, Events } from "discord.js";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { chat } from "./claude.js";

const MAX_HISTORY_MESSAGES = 20;
const histories = new Map<string, MessageParam[]>();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

client.once(Events.ClientReady, (c) => {
  console.log(`Logged in as ${c.user.tag}`);
  scheduleDailyReminder();
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  const isDM = !message.guild;
  const isMentioned = client.user ? message.mentions.has(client.user) : false;
  if (!isDM && !isMentioned) return;

  const content = message.content
    .replace(new RegExp(`<@!?${client.user?.id}>`, "g"), "")
    .trim();
  if (!content) return;

  const historyKey = message.channelId;
  const history = histories.get(historyKey) ?? [];
  history.push({ role: "user", content });

  await message.channel.sendTyping();

  try {
    const { reply, history: updatedHistory } = await chat(
      message.author.id,
      history
    );
    histories.set(historyKey, trimHistory(updatedHistory, MAX_HISTORY_MESSAGES));

    for (const chunk of splitMessage(reply)) {
      await message.reply(chunk);
    }
  } catch (err) {
    console.error(err);
    await message.reply(
      "すみません、エラーが発生しました。もう一度お試しください。"
    );
  }
});

function scheduleDailyReminder(): void {
  const targetUserId = process.env.REMINDER_USER_ID;
  if (!targetUserId) return;

  const reminderHour = Number(process.env.REMINDER_HOUR ?? 8);
  let lastSentDateKey = "";

  setInterval(async () => {
    const now = new Date();
    const dateKey = now.toDateString();
    // その日まだ送っていなくて、リマインド時刻を過ぎていれば送る（起動直後やスリープ復帰後も、
    // ちょうどその分を逃さず追いつけるように「時刻ぴったり」ではなく「以降ならOK」で判定する）
    if (lastSentDateKey === dateKey) return;
    if (now.getHours() < reminderHour) return;
    lastSentDateKey = dateKey;

    try {
      const user = await client.users.fetch(targetUserId);
      const { reply } = await chat(targetUserId, [
        {
          role: "user",
          content:
            "おはようございます。今日確認すべきことをまとめてください。期限が過ぎている・今日から3日以内に期限が来るタスクを一覧し、必要ならカレンダーの今日の予定も確認してください。何もなければ、その旨を短く伝えてください。",
        },
      ]);
      for (const chunk of splitMessage(reply)) {
        await user.send(chunk);
      }
    } catch (err) {
      console.error("Failed to send daily reminder:", err);
    }
  }, 60 * 1000);
}

function isDanglingContinuation(message: MessageParam): boolean {
  // A user message made up entirely of tool_result blocks is a continuation of
  // the previous assistant turn, not a fresh user turn — it can't stand alone.
  if (message.role !== "user" || !Array.isArray(message.content)) return false;
  return (
    message.content.length > 0 &&
    message.content.every(
      (block) => typeof block === "object" && block !== null && block.type === "tool_result"
    )
  );
}

function trimHistory(history: MessageParam[], maxMessages: number): MessageParam[] {
  let start = Math.max(0, history.length - maxMessages);
  // Advance past any assistant message or dangling tool_result continuation so the
  // trimmed history starts on a genuine user turn and never splits a tool_use/tool_result pair.
  while (start < history.length && (history[start].role !== "user" || isDanglingContinuation(history[start]))) {
    start++;
  }
  return history.slice(start);
}

function splitMessage(text: string, limit = 1900): string[] {
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > limit) {
    chunks.push(remaining.slice(0, limit));
    remaining = remaining.slice(limit);
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

client.login(process.env.DISCORD_TOKEN);
