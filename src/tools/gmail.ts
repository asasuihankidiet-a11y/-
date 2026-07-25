import { google } from "googleapis";
import { getGoogleAuth } from "../google-auth.js";

function gmailClient() {
  const auth = getGoogleAuth();
  if (!auth) {
    throw new Error(
      "Google連携が未設定です。GOOGLE_CLIENT_ID等を.envに設定し、npm run google-authを実行してください。"
    );
  }
  return google.gmail({ version: "v1", auth });
}

export async function listRecentEmails(maxResults = 5) {
  const gmail = gmailClient();
  const list = await gmail.users.messages.list({
    userId: "me",
    maxResults,
    labelIds: ["INBOX"],
  });
  const messages = list.data.messages ?? [];

  const details = await Promise.all(
    messages.map(async (m) => {
      const msg = await gmail.users.messages.get({
        userId: "me",
        id: m.id!,
        format: "metadata",
        metadataHeaders: ["From", "Subject", "Date"],
      });
      const headers = msg.data.payload?.headers ?? [];
      const get = (name: string) =>
        headers.find((h) => h.name === name)?.value ?? "";
      return {
        id: m.id,
        from: get("From"),
        subject: get("Subject"),
        date: get("Date"),
        snippet: msg.data.snippet,
      };
    })
  );
  return details;
}

export interface DraftEmailInput {
  to: string;
  subject: string;
  body: string;
}

export async function createDraftEmail(input: DraftEmailInput) {
  const gmail = gmailClient();
  const raw = Buffer.from(
    `To: ${input.to}\r\nSubject: ${input.subject}\r\nContent-Type: text/plain; charset="UTF-8"\r\n\r\n${input.body}`
  )
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await gmail.users.drafts.create({
    userId: "me",
    requestBody: { message: { raw } },
  });
  return { id: res.data.id };
}
