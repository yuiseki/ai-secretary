# Agentic Heartbeat Reports

このディレクトリは、OpenClaw と派生/比較プロジェクトにおける heartbeat / cron / scheduler（定期実行）実装調査レポートの公開版です。

## レポート一覧

- `AGENTIC_HEARTBEAT.md`: 全体比較・設計論点・再実装指針をまとめた包括レポート
- `projects/openclaw.md`: OpenClaw の heartbeat/cron 実装詳細
- `projects/nanobot.md`: NanoBot の heartbeat/cron 実装詳細
- `projects/picoclaw.md`: PicoClaw の heartbeat/cron 実装詳細
- `projects/zeroclaw.md`: ZeroClaw の heartbeat/cron 実装詳細
- `projects/ironclaw.md`: IronClaw の heartbeat/routines 実装詳細
- `projects/mimiclaw.md`: MimiClaw（mimiclaw）の heartbeat/cron 実装詳細
- `projects/nanoclaw.md`: NanoClaw の scheduled task 実装詳細（heartbeat非採用）
- `projects/tinyclaw.md`: TinyClaw の queue+shell/crontab ベース実装詳細
- `projects/safeclaw.md`: SafeClaw の APScheduler ベース定期実行実装（比較対象）
- `projects/penny.md`: Penny の idle-aware background scheduler 実装（比較対象）

## 公開版ポリシー

- 内部ディレクトリ運用メモ（作業 TODO / 一時ノート）は除外
- 公開に不要な内部パス参照は削除
