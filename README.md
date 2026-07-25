# AI秘書 (Discord Bot)

Discord上で動くAI秘書ボットです。Claude APIで会話・タスク管理を行い、Googleカレンダー・Gmailと連携します。

## 機能

- 雑談・質問応答
- タスク・ToDo管理（追加・一覧・完了・削除）
- Googleカレンダーの予定確認・追加
- Gmail受信トレイの確認、下書き作成（安全のため自動送信はしません）

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Discord Botの作成

1. [Discord Developer Portal](https://discord.com/developers/applications) で新しいアプリケーションを作成
2. 「Bot」タブでBotを作成し、トークンを取得
3. 「Bot」タブで以下のIntentを有効化: `MESSAGE CONTENT INTENT`
4. 「OAuth2 > URL Generator」で `bot` スコープと `Send Messages` / `Read Message History` 権限を選び、生成されたURLでサーバーに招待

### 3. Anthropic APIキーの取得

[Anthropic Console](https://console.anthropic.com/) でAPIキーを発行します。

### 4. Google OAuth設定（Calendar / Gmail連携）

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. 「APIとサービス」で **Google Calendar API** と **Gmail API** を有効化
3. 「認証情報」で「OAuthクライアントID」（種類: デスクトップアプリ）を作成し、クライアントIDとシークレットを取得
4. `.env` に `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` を設定
5. 以下を実行してブラウザ認可フローを行い、`GOOGLE_REFRESH_TOKEN` を取得:

```bash
npm run google-auth
```

表示されたURLをブラウザで開いて認可すると、ターミナルに `refresh_token` が出力されるので `.env` に設定してください。

Google連携をしない場合は手順4・5を省略できます（カレンダー/メール機能のみ利用不可になります）。

### 5. 環境変数の設定

`.env.example` を `.env` にコピーして値を埋めてください。

```bash
cp .env.example .env
```

### 6. 起動

開発時:

```bash
npm run dev
```

本番運用時:

```bash
npm run build
npm start
```

## 使い方

- BotにDMを送る、またはサーバー内でBotをメンションして話しかけると応答します
- 例: 「明日15時から16時に打ち合わせを予定に入れて」「タスクに『資料作成』を追加して」「今日の予定を教えて」「最近のメール見せて」

## データ

タスクはローカルのSQLiteファイル（`DB_PATH` で指定、デフォルト `./data.sqlite`）に保存されます。
