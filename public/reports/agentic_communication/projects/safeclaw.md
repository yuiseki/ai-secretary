# SafeClaw

## Quick facts
- Slack / Discord を会話チャネルとしては実装していない。
- webhook trigger/action の一部として Slack/Discord 送信ヘルパーを持つ。
- 本レポートでは「通知 delivery の比較対象」。

## 主要実装ファイル
- webhook trigger / sender: `repos/_claw/safeclaw/src/safeclaw/triggers/webhook.py`

## 通信アーキテクチャ（本レポート観点）

### 位置づけ
- SafeClaw は rule-based automation / trigger-action engine 寄りであり、agent-user chat session の管理は主題ではない。
- Slack/Discord は通知先 webhook として扱われる。

### `webhook.py` の要点
- generic webhook sender を提供。
- SSRF 対策や optional HMAC signature を持つ。
- `send_to_slack()` / `send_to_discord()` の convenience method がある。
- inbound signature header 互換性として `x_slack_signature` なども扱う。

## 再実装での参考点
- 会話チャネルとは別に、delivery 専用 webhook layer を分離する設計は有用。
- OpenClaw の cron/heartbeat delivery を webhook に逃がす際の安全策（SSRF/HMAC）の参考になる。

## 留意点
- thread/session routing、typing、interactive commands、Gateway reconnect などの比較には使えない。
- Slack/Discord bot 実装の代替にはならない。
