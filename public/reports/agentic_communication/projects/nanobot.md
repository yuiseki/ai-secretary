# NanoBot

## Quick facts
- Python 製の軽量 message bus アーキテクチャ。
- Slack / Discord の両方を実装しつつ、channel と agent loop を bus で疎結合化している。
- preflight は必要十分、metadata pass-through の設計が良い。

## 主要実装ファイル
- bus types: `repos/_claw/nanobot/nanobot/bus/events.py`
- bus queue: `repos/_claw/nanobot/nanobot/bus/queue.py`
- channel base: `repos/_claw/nanobot/nanobot/channels/base.py`
- channel manager: `repos/_claw/nanobot/nanobot/channels/manager.py`
- Slack channel: `repos/_claw/nanobot/nanobot/channels/slack.py`
- Discord channel: `repos/_claw/nanobot/nanobot/channels/discord.py`
- agent bridge: `repos/_claw/nanobot/nanobot/agent/loop.py`
- config schema: `repos/_claw/nanobot/nanobot/config/schema.py`

## 全体アーキテクチャ

### MessageBus 中心
- `InboundMessage` / `OutboundMessage` を async queue で流す。
- `session_key = f"{channel}:{chat_id}"` の規約が明確。
- channel 側は `_handle_message()` で inbound を publish するだけでよい。
- agent loop は inbound を消費して応答を生成し、outbound を publish する。

### metadata の持ち回り
- `agent/loop.py` は outbound 作成時に inbound metadata を継承できる。
- Slack `thread_ts` / Discord `reply_to` / `guild_id` などを失わずに返信側へ渡せる。
- この設計が thread reply と channel-specific UX の実装を容易にしている。

## Slack 実装

### transport
- Slack Socket Mode を利用。
- イベント受信時に即 ack する構成。

### inbound handling
- `message` と `app_mention` を主に扱う。
- mention イベントの二重処理を避けるガードあり。
- group policy（`open/mention/allowlist`）と DM policy（`open/allowlist`）をサポート。
- 処理開始時に `eyes` reaction を付ける。

### outbound
- `reply_in_thread` オプションで thread reply を制御。
- Slack metadata（channel/thread/event ts）を outbound send に使う。
- Markdown -> Slack mrkdwn 変換ヘルパーがあり、テーブル変換まで扱う。

## Discord 実装

### transport
- Discord Gateway を manual WebSocket 実装。
- HELLO / IDENTIFY / heartbeat / reconnect を自前制御。

### inbound handling
- bot/self filter、allowlist 判定。
- attachments をローカル保存し、本文に placeholder を埋める。
- typing loop を開始してから inbound を bus に publish。

### outbound
- REST API で送信。
- typing endpoint 利用。
- 2000文字制限で chunking。
- 429 rate limit に retry 対応。

## Notable ideas
- bus + metadata pass-through だけで Slack/Discord thread reply を十分に成立させている。
- channel manager が outbound を channel ごとに dispatch するため、agent loop は transport を知らなくてよい。
- 実装量の割に UX（typing / ack reaction）を押さえている。

## 留意点
- OpenClaw のような pairing / interactive UI / 複雑routing は持たない。
- Discord manual gateway は制御しやすい反面、運用 hardening を自前で増やす必要がある。
