# Penny（比較対象）

## Quick facts
- `MessageChannel` 抽象クラスでチャネル共通処理をまとめる framework-style 設計。
- Discord チャネル実装を持つが、単一 configured channel 前提で OpenClaw よりスコープは狭い。
- reaction を入力イベントとして扱う点が実用的。

## 主要実装ファイル
- channel abstraction: `repos/_claw/penny/penny/penny/channels/base.py`
- channel selector: `repos/_claw/penny/penny/penny/channels/__init__.py`
- Discord channel: `repos/_claw/penny/penny/penny/channels/discord/channel.py`
- Discord models: `repos/_claw/penny/penny/penny/channels/discord/models.py`

## 全体アーキテクチャ

### `MessageChannel` 抽象クラス（`channels/base.py`）
共通責務を base class に集約している。

- `listen`
- `send_message`
- `send_typing`
- `extract_message`
- `close`
- `handle_message()`（共通 pipeline）

`handle_message()` は、event -> normalize -> command/reaction handling -> typing loop -> agent call -> DB logging -> response send の流れを共通化している。

### channel selection
- `channels/__init__.py` で config に応じて `DiscordChannel` / `SignalChannel` を選択。
- runtime plugin ではなく、アプリ内の class 選択で差し替える構成。

## Discord 実装（`channels/discord/channel.py`）

### transport / lifecycle
- `discord.py` (`discord.Client`) を利用。
- `on_ready` で configured channel を解決し、利用可能性を確認。

### inbound handling
- `on_message` で configured channel に限定して処理。
- Pydantic `DiscordMessage`（`models.py`）に詰めてから base `handle_message()` に渡す。
- `on_reaction_add` では reaction を特別な `IncomingMessage` として扱える。

### outbound / UX
- `send_message()` は 2000文字 chunking。
- `send_typing()` は Discord typing indicator を使用。

## 再実装での参考点
- channel 共通 pipeline を base class に寄せる設計は、イベント処理の重複を減らしやすい。
- reaction を first-class input event として扱うと、軽量な UI 操作が実装しやすい。

## 留意点
- 単一 channel 前提で、OpenClaw の multi-account / multi-guild / thread routing とは前提が異なる。
- Slack 実装は本調査対象としては存在しない（Signal が別チャネル）。
