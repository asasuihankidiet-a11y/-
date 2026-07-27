import "dotenv/config";
import { createServer } from "node:http";
import { google } from "googleapis";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/tasks",
];

async function main() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:53682/oauth2callback";

  if (!clientId || !clientSecret) {
    console.error(
      "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET を .env に設定してから実行してください。"
    );
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const url = new URL(redirectUri);
  const port = Number(url.port) || 53682;

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });

  console.log("以下のURLをブラウザで開いて、Googleアカウントの認可を行ってください:\n");
  console.log(authUrl);
  console.log(`\nリダイレクト待機中... (${redirectUri})`);

  const server = createServer(async (req, res) => {
    if (!req.url) return;
    const reqUrl = new URL(req.url, redirectUri);
    if (reqUrl.pathname !== url.pathname) {
      res.writeHead(404);
      res.end();
      return;
    }
    const code = reqUrl.searchParams.get("code");
    if (!code) {
      res.writeHead(400);
      res.end("認可コードが見つかりませんでした。");
      return;
    }
    const { tokens } = await oauth2Client.getToken(code);
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("認可が完了しました。このタブは閉じて構いません。");
    console.log("\n取得できたrefresh_tokenを .env の GOOGLE_REFRESH_TOKEN に設定してください:\n");
    console.log(tokens.refresh_token);
    server.close();
    process.exit(0);
  });

  server.listen(port);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
