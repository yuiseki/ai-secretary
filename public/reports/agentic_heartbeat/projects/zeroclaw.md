# ZeroClaw

## Quick facts
- Rust 実装。heartbeat は軽量、cron scheduler は比較的高機能。
- cron は SQLite + typed schedule/job/delivery/run history + security policy を持つ。
- heartbeat は `HEARTBEAT.md` の bullet parse を行い、各タスクを個別 `agent::run` する。

## 主要実装ファイル
- heartbeat engine: `repos/_claw/zeroclaw/src/heartbeat/engine.rs`
- daemon heartbeat worker: `repos/_claw/zeroclaw/src/daemon/mod.rs`
- cron types: `repos/_claw/zeroclaw/src/cron/types.rs`
- cron store (SQLite): `repos/_claw/zeroclaw/src/cron/store.rs`
- cron scheduler loop: `repos/_claw/zeroclaw/src/cron/scheduler.rs`

## Heartbeat 実装（OpenClawとは意味が少し違う）
- `HeartbeatEngine` は `HEARTBEAT.md` を読み、`- ` で始まる行を task として抽出する。
- `tick()` 自体は task 数を返すだけで、LLM実行は `daemon::run_heartbeat_worker()` 側が担当。
- daemon worker は各 task ごとに `crate::agent::run("[Heartbeat Task] ...")` を呼ぶ。
- default heartbeat template を生成する helper あり、interval は最低5分。

### 特徴
- 「1回の heartbeat で checklist 全体を見て優先度判断する」方式ではなく、タスク fan-out に近い。
- observability の heartbeat tick カウンタを持つ。

## Cron 実装
- SQLite `cron_jobs` / `cron_runs` を rusqlite で管理。
- schedule: `Cron` / `At` / `Every`
- job type: `Shell` / `Agent`
- session target: `Main` / `Isolated`
- delivery config: `announce` など（channel/to/best_effort）

### Scheduler loop
- `config.reliability.scheduler_poll_secs` 間隔で due jobs を取得。
- `buffer_unordered(max_concurrent)` で並列実行。
- job execution は retry/backoff 付き (`execute_job_with_retry`)。
- shell job は `SecurityPolicy` による command/path/action budget/rate limit ガード。
- run result を DB に記録し、run history retention を pruning。

### Delivery
- `announce` mode の場合、configured channel (telegram/discord/slack/mattermost) に直接送信。
- `best_effort` によって delivery failure を job失敗扱いにするか切替。

## Notable ideas
- cron 側の責務分離（schedule/store/scheduler/delivery/security）が整理されている。
- shell jobs に security policy を徹底している点は再実装時に重要。

## 留意点
- heartbeat は OpenClaw 的な main session heartbeat とは別モデル（task fan-out）なので比較時に注意。
- heartbeat no-op の履歴/重複抑制などは主眼ではない。
