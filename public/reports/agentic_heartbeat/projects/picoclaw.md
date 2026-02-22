# PicoClaw

## Quick facts
- Go 実装の heartbeat + cron。NanoBot 系の思想を実用寄りに拡張。
- heartbeat は `NoHistory` セッションで独立実行、async subagent（spawn）と相性が良い。
- cron tool が scheduling と job execution の実務ロジックをまとめている。

## 主要実装ファイル
- heartbeat: `repos/_claw/picoclaw/pkg/heartbeat/service.go`
- cron service: `repos/_claw/picoclaw/pkg/cron/service.go`
- cron tool: `repos/_claw/picoclaw/pkg/tools/cron.go`
- agent heartbeat path: `repos/_claw/picoclaw/pkg/agent/loop.go`
- gateway wiring: `repos/_claw/picoclaw/cmd/picoclaw/cmd_gateway.go`

## Heartbeat 実装
- `HeartbeatService` は ticker ベース（interval minutes）で実行。
- startup 後 1秒で first heartbeat を投げる `time.AfterFunc` を持つ。
- `HEARTBEAT.md` がなければデフォルトテンプレートを生成して今回は skip。
- `buildPrompt()` は時刻付き prompt + spawn 利用の明示指示を含む。
- last channel state を参照して通知先の channel/chatID を解決し、bus へ送信。

### Agent 実行の重要点
- `ProcessHeartbeat()` は `SessionKey="heartbeat"` かつ `NoHistory=true`。
- heartbeat は会話履歴を蓄積せず、各tick独立に扱う方針。
- handler 側で `HEARTBEAT_OK` を `SilentResult` に変換し、不要通知を抑制。

## Cron 実装
- JSON store + mutex。
- 1秒 ticker で `checkJobs()` を回し、due job を検出。
- due 検出時に **実行前に `NextRunAtMS=nil` を保存**して duplicate fire を回避。
- 実行後に one-shot delete/disable、それ以外は next run 計算（cron expr は `gronx` 使用）。

## CronTool（実行/配送を担う）
- tool surface: `add/list/remove/enable/disable`
- schedule 入力: `at_seconds` / `every_seconds` / `cron_expr`
- payload に `command` を持てる（shell command 実行）
- `deliver=true` なら直接 bus 送信、`deliver=false` なら agent 実行へ回す

## OpenClaw との比較ポイント
- `main` vs `isolated` の型分離はなく、ツール層で分岐している。
- wake queue や heartbeat 連携は薄いが、no-history heartbeat と async spawn 支援は実用的。

## Notable ideas
- heartbeat を「独立セッション + async subagent orchestration」の入口にしている点が良い。
- lightweight だが duplicate 防止の最小限対策が入っている。

## 留意点
- 高度な scheduler reliability（backoff, replay, stale marker cleanup）は未搭載。
- execution/delivery が tool に集約されるため、将来の複雑な delivery policy 追加時に再設計余地あり。
