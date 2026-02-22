# NanoClaw

## Quick facts
- `HEARTBEAT.md` 型の heartbeat は中心機能ではなく、SQLite `scheduled_tasks` による scheduler が主役。
- group / container isolation 前提の multi-tenant scheduler。
- scheduled tasks は `cron` / `interval` / `once` と `context_mode` (`group` / `isolated`) を持つ。

## 主要実装ファイル
- scheduler loop: `repos/_claw/nanoclaw/src/task-scheduler.ts`
- DB model/access: `repos/_claw/nanoclaw/src/db.ts`
- task creation IPC: `repos/_claw/nanoclaw/src/ipc.ts`
- scheduler-related types: `repos/_claw/nanoclaw/src/types.ts`
- group serialization/concurrency: `repos/_claw/nanoclaw/src/group-queue.ts`

## Scheduled Task アーキテクチャ

### データモデル
- `scheduled_tasks` table（SQLite）
- fields:
  - `schedule_type`: `cron` / `interval` / `once`
  - `schedule_value`
  - `context_mode`: `group` / `isolated`
  - `next_run`, `last_run`, `last_result`, `status`
- `task_run_logs` に実行ログを保存

### Scheduler loop
- `startSchedulerLoop()` が `SCHEDULER_POLL_INTERVAL`（既定 60s）で due task を取得。
- due task は DB 再取得で active 状態を再確認してから `GroupQueue` へ enqueue。
- ループ自身は軽く、実行は queue + container runner に委譲。

### 実行モデル
- `runTask()` は container agent を起動し、streamed output を `sendMessage()` でユーザーへ転送。
- `context_mode=group` の場合は group session を継続利用、`isolated` は分離コンテキスト。
- 実行後に `next_run` を再計算し、`once` は `completed` 化。

### GroupQueue による運用制御
- groupごとに active/pending 状態を保持し直列実行。
- global concurrency cap (`MAX_CONCURRENT_CONTAINERS`) を持つ。
- message処理と scheduled task を同一 queue policy で調停。
- retry/backoff を message側に実装（task側はシンプル）。

### IPC での task 登録
- `schedule_task` で cron/interval/once を検証し `next_run` 算出。
- non-main group は「自分の group への schedule だけ」許可（認可チェック）。

## Notable ideas
- scheduler と container orchestration / group isolation を一体で設計している。
- DB駆動 + queue 調停は multi-tenant agent 環境で強い。

## 留意点
- OpenClaw 的 heartbeat checklist/no-op 最適化とは別問題領域。
- scheduler の精度は polling interval に依存（既定 60s）。
