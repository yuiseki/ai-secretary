# MimiClaw (mimiclaw)

## Quick facts
- ESP32/FreeRTOS 向け組込実装。
- heartbeat と cron の両方を inbound message bus へ注入する構成。
- リソース制約を強く意識した static array + SPIFFS JSON の設計。

## 主要実装ファイル
- heartbeat: `repos/_claw/mimiclaw/main/heartbeat/heartbeat.c`
- cron service: `repos/_claw/mimiclaw/main/cron/cron_service.c`
- cron tool: `repos/_claw/mimiclaw/main/tools/tool_cron.c`
- cron target patching: `repos/_claw/mimiclaw/main/agent/agent_loop.c`

## Heartbeat 実装
- FreeRTOS software timer (`xTimerCreate`, auto-reload) で一定間隔実行。
- `HEARTBEAT.md` を行単位で読み、以下を除外して actionable line を検出:
  - 空行
  - markdown header
  - 完了checkbox (`- [x]`, `* [x]`)
- actionable content がある場合のみ、固定 heartbeat prompt を `system:heartbeat` として inbound queue に push。

### 特徴
- heartbeat 自体は LLM を直接呼ばず、message bus へ注入するだけ。
- manual CLI コマンド `heartbeat_trigger` で即時発火可能。

## Cron 実装
- `cron_job_t` の static array（最大数固定） + `cron.json` (SPIFFS) 永続化。
- schedule types: `every` / `at`（cron expr なし）
- FreeRTOS task が一定間隔で `cron_process_due_jobs()` を呼ぶ。
- due job は inbound message bus に message を push。
- one-shot は delete or disable、recurring は `next_run = now + interval`。

## ルーティング安全性（実装が地味に良い）
- `tool_cron.c` で Telegram `chat_id` 必須チェック。
- `cron_service.c` でも destination sanitize（空や `cron` を補正/警告）。
- `agent_loop.c` が `cron_add` の tool input を turn context から patch して、Telegram 宛先をユーザー会話の `chat_id` に揃える。

## Notable ideas
- すべてを message bus 注入に寄せたため、interactive/heartbeat/cron の処理経路が揃う。
- 組込であっても one-shot delete semantics と宛先サニタイズを入れている。

## 留意点
- cron expression / timezone / isolated session / retry/backoff などは未対応。
- static array 上限や JSON サイズ制約があるため、大量ジョブ運用には不向き。
