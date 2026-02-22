# IronClaw

## Quick facts
- heartbeat に加え、trigger/action/guardrail を一般化した `routines` エンジンを持つ。
- heartbeat は OpenClaw 系の checklist + `HEARTBEAT_OK` 契約だが、運用タスク（memory hygiene）も同居。
- routines は cron/event/webhook/manual trigger を DB で永続化し、run log を持つ。

## 主要実装ファイル
- heartbeat: `repos/_claw/ironclaw/src/agent/heartbeat.rs`
- routine types: `repos/_claw/ironclaw/src/agent/routine.rs`
- routine engine: `repos/_claw/ironclaw/src/agent/routine_engine.rs`
- parallel job scheduler: `repos/_claw/ironclaw/src/agent/scheduler.rs`
- routines schema: `repos/_claw/ironclaw/migrations/V6__routines.sql`

## Heartbeat 実装
- `HeartbeatRunner` が interval loop で `HEARTBEAT.md` checklist を処理。
- checklist は `workspace.heartbeat_checklist()` から取得し、effectively empty なら skip。
- prompt は checklist 全体を埋め込む単一 heartbeat LLM turn。
- `HEARTBEAT_OK` を含む応答は no-op と扱い通知しない。
- notification channel があれば `OutgoingResponse` で送信。
- consecutive failures を数え、閾値超えで heartbeat loop を停止。

### 独自ポイント
- 各 tick で `workspace::hygiene::run_if_due()` を background spawn し、memory hygiene を heartbeat loop に組み込む。

## Routines エンジン（cron を一般化した本命）

### データモデル
- `routines` table:
  - trigger (`cron` / `event` / `webhook` / `manual`)
  - action (`lightweight` / `full_job`)
  - guardrails (`cooldown`, `max_concurrent`, dedup window)
  - notify policy
  - runtime state (`last_run_at`, `next_fire_at`, failures, state JSON)
- `routine_runs` table:
  - trigger_type, status, summary, tokens, timestamps, optional job_id

### 実行エンジン
- cron ticker loop: DB から due cron routines を polling
- event matcher: main message loop から同期呼び出し（regex match）
- guardrails:
  - cooldown check
  - per-routine concurrent run count
  - global max concurrent routines
- run記録を作って async 実行、完了後に runtime state を更新し通知

### Action モード
- `Lightweight`: single LLM call（toolなし、context_paths/state.md 読み込み）
- `FullJob`: 将来の scheduler 統合を想定（現状は lightweight fallback with warning）

## OpenClaw との比較ポイント
- heartbeat の思想は近いが、cron を routines へ一般化して拡張している。
- OpenClaw の `main` vs `isolated` cron より、trigger/action/guardrail のモデル化が強い。
- event/webhook trigger を定期実行基盤に自然に統合できる。

## Notable ideas
- `routines` は cron scheduler の上位抽象として再実装に非常に参考になる。
- lightweight routine の state を `routines/<name>/state.md` に持つなど、運用透明性も高い。

## 留意点
- full_job モードは未完成（現状 fallback）。
- 実装量が多く、MVP 再実装にはオーバースペックになりやすい。
