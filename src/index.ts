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
    const trimmed = updatedHistory.slice(-MAX_HISTORY_MESSAGES);
    histories.set(historyKey, trimmed);

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
