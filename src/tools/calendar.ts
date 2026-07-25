import { google } from "googleapis";
import { getGoogleAuth } from "../google-auth.js";

export interface CalendarEventInput {
  summary: string;
  startIso: string;
  endIso: string;
  description?: string;
}

function calendarClient() {
  const auth = getGoogleAuth();
  if (!auth) {
    throw new Error(
      "Google連携が未設定です。GOOGLE_CLIENT_ID等を.envに設定し、npm run google-authを実行してください。"
    );
  }
  return google.calendar({ version: "v3", auth });
}

export async function listUpcomingEvents(maxResults = 10) {
  const calendar = calendarClient();
  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: new Date().toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: "startTime",
  });
  return (res.data.items ?? []).map((e) => ({
    id: e.id,
    summary: e.summary,
    start: e.start?.dateTime ?? e.start?.date,
    end: e.end?.dateTime ?? e.end?.date,
  }));
}

export async function createEvent(input: CalendarEventInput) {
  const calendar = calendarClient();
  const res = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: input.summary,
      description: input.description,
      start: { dateTime: input.startIso },
      end: { dateTime: input.endIso },
    },
  });
  return {
    id: res.data.id,
    summary: res.data.summary,
    htmlLink: res.data.htmlLink,
  };
}
