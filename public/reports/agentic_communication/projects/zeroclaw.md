# ZeroClaw

## Quick facts
- Rust の trait-based multi-channel runtime。
- Slack / Discord 実装を `Channel` trait に揃え、共通 dispatch loop で監督する設計が中核。
- Slack は polling、Discord は manual gateway という対照的な実装を同じ抽象で扱っている。

## 主要実装ファイル
- channel trait: `repos/_claw/zeroclaw/src/channels/traits.rs`
- channel runtime / dispatch loop: `repos/_claw/zeroclaw/src/channels/mod.rs`
- Discord channel: `repos/_claw/zeroclaw/src/channels/discord.rs`
- Slack channel: `repos/_claw/zeroclaw/src/channels/slack.rs`
- config schema: `repos/_claw/zeroclaw/src/config/schema.rs`

## 全体アーキテクチャ

### `Channel` trait
- `send`
- `listen`
- `health_check`
- typing hooks
- draft update hooks

通信チャネルごとの差は trait 実装に閉じ込め、共通 runtime は `ChannelMessage` / `SendMessage` の抽象だけを見る。

### 共通 runtime（`channels/mod.rs`）
- 各 channel listener を supervise し、再起動/監視の足場を提供。
- unified dispatch loop で inbound を処理。
- bounded parallelism、typing refresh task、draft update、memory/provider/tool dispatch を共通化。
- final delivery は `channel.send(...).in_thread(msg.thread_ts.clone())` の形で thread を尊重。

## Discord 実装

### transport
- `tokio_tungstenite` による manual Gateway WS。
- `/gateway/bot` から endpoint を取得。
- heartbeat / reconnect / invalid session を処理。

### preflight / policy
- `mention_only` 対応（メンション正規化あり）。
- `allowed_users`（空なら deny all、`*` で allow all）。
- optional guild filter。

### outbound / UX
- `reply_target` を channel id として利用。
- typing は REST `/typing`。
- 2000文字 chunking。

## Slack 実装

### transport（特徴的）
- Socket Mode ではなく **Web API polling** (`conversations.history`)。
- 固定 `channel_id` を監視し、約3秒間隔で差分取得。
- `auth.test` で bot user id を取得して self message を除外。

### threading
- `thread_ts`（または `ts`）を inbound に保持。
- outbound `chat.postMessage` に `thread_ts` を指定して thread reply。

### policy
- `allowed_users`（空 deny, `*` allow）。
- `last_ts` で差分管理し、重複処理を避ける。

## Notable ideas
- trait に typing/draft update まで含めたことで、channel UX 差分を runtime 側で統一しやすい。
- Slack と Discord で transport 手法が大きく異なっても、共通 dispatch loop を保てている。

## 留意点
- Slack polling は依存が少ないが、Socket Mode/Event API に比べてイベント網羅性と即時性で不利。
- OpenClaw のような native interactive commands / pairing / rich route preflight は現状薄い。
