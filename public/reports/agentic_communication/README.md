# Agentic Communication Reports

このディレクトリは、OpenClaw と派生プロジェクトの Agentic Communication（とくに Slack / Discord を介したユーザー対話）実装調査レポートの公開版です。

## レポート一覧

- `AGENTIC_COMMUNICATION.md`: 全体比較と設計論点をまとめた包括レポート
- `projects/openclaw.md`: OpenClaw の通信チャネル実装詳細（Slack/Discord中心）
- `projects/nanobot.md`: NanoBot の通信チャネル実装詳細
- `projects/picoclaw.md`: PicoClaw の通信チャネル実装詳細
- `projects/zeroclaw.md`: ZeroClaw の通信チャネル実装詳細
- `projects/ironclaw.md`: IronClaw の通信チャネル構想（WASM channel registry/capabilities）
- `projects/mimiclaw.md`: MimiClaw（mimiclaw）の通信面（Telegram/WebSocket中心、Slack/Discord未実装）
- `projects/nanoclaw.md`: NanoClaw のチャネル拡張アプローチ（skillベース追加）
- `projects/tinyclaw.md`: TinyClaw の Discord DM + file queue アーキテクチャ
- `projects/safeclaw.md`: SafeClaw の webhook 通知実装（Slack/Discord送信ユーティリティ）
- `projects/penny.md`: Penny の Discord チャネル抽象化（比較対象）

## 公開版ポリシー

- 内部ディレクトリ運用メモ（作業 TODO / 一時ノート）は除外
- 公開に不要な内部パス参照は削除
