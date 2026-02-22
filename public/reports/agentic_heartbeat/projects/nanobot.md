# NanoBot

## Quick facts
- Python 実装のシンプルな heartbeat + cron 基盤。
- `HEARTBEAT.md` と `cron/jobs.json` を使う最小構成。
- callback ベースで agent 実行を差し込む設計。

## 主要実装ファイル
- heartbeat: `repos/_claw/nanobot/nanobot/heartbeat/service.py`
- cron: `repos/_claw/nanobot/nanobot/cron/service.py`
- cron types: `repos/_claw/nanobot/nanobot/cron/types.py`
- gateway wiring: `repos/_claw/nanobot/nanobot/cli/commands.py`

## Heartbeat 実装
- `HeartbeatService` は asyncio task + `sleep(interval_s)` の単純ループ。
- `HEARTBEAT.md` を読み、empty/missing なら heartbeat tick を skip。
- empty判定は headers / コメント / checkbox を除外するヒューリスティック。
- `on_heartbeat(prompt)` callback で agent を起こし、応答に `HEARTBEAT_OK` が含まれるかで no-op 判定。

### 特徴
- missing file も skip（OpenClaw は missing を許容して継続実行する経路がある）。
- no-op 判定は文字列ベースで、履歴・重複通知の抑制は実装しない。

## Cron 実装
- JSON store をロードして in-memory cache を保持。
- schedule kinds: `at` / `every` / `cron`（`croniter` + `zoneinfo`）
- 次回 wake 時刻を計算し、1本の asyncio timer task を arm。
- due job は順番に `_execute_job()` 実行、完了後に `next_run_at_ms` 更新。

## 実行/配送モデル
- `on_job(job)` callback が通常 `agent.process_direct(session_key=f"cron:{job.id}")` を呼ぶ。
- payload の `deliver/channel/to` に応じて callback 側で直接メッセージ配信も可能。
- execution と delivery が callback 層に集約されていて簡潔。

## Notable ideas
- 非常に小さい実装で `at/every/cron + timezone` を成立させている。
- 学習/再実装の起点として最適な構造。

## 留意点
- busy レーン調停、wake coalescing、retry/backoff、stale marker cleanup などの運用耐性は薄い。
- callback に責務が集まるため、機能追加で密結合になりやすい。
