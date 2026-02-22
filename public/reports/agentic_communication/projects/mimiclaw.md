# MimiClaw（mimiclaw）

## Quick facts
- 本調査時点で Slack / Discord チャネル実装は確認できない。
- 通信面は Telegram bot と WebSocket gateway が中心。
- OpenClaw 派生の比較対象としては、「別チャネル（Telegram/WebSocket）での最小構成設計」の参考になる。

## 主要実装ファイル
- Telegram bot: `repos/_claw/mimiclaw/main/telegram/telegram_bot.c`
- Telegram header: `repos/_claw/mimiclaw/main/telegram/telegram_bot.h`
- WebSocket gateway: `repos/_claw/mimiclaw/main/gateway/ws_server.c`
- Agent loop bridge: `repos/_claw/mimiclaw/main/agent/agent_loop.c`
- Context builder: `repos/_claw/mimiclaw/main/agent/context_builder.c`

## 通信アーキテクチャ（本レポート観点）

### Slack / Discord について
- `main/` 配下の実装確認では Slack / Discord 用の runtime channel は見当たらない。
- したがって、本レポートの Slack/Discord 実装比較表では「未実装」として扱う。

### 代替チャネル（Telegram / WebSocket）
- Telegram bot がユーザー接点チャネルとして機能。
- WebSocket gateway も別の通信入口として存在。
- `agent_loop.c` 側へメッセージを注入する構図は、他派生の bus/queue アーキテクチャと比較可能。

## 再実装での参考点
- チャネル種別が違っても、最終的に agent loop へ渡すメッセージ境界を揃えれば横展開しやすい。
- リソース制約環境でのチャネル実装は、transport 機能を絞っても成立する。

## 留意点
- Slack/Discord のスレッド、interaction、allowlist/pairing 等の比較材料にはならない。
- 本レポートでは「OpenClaw思想の別チャネル実装」として位置づけるのが妥当。
