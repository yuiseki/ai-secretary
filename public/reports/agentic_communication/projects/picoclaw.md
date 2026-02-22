# PicoClaw

## Quick facts
- Go 製の bus ベース実装で、NanoBot の思想を実用向けに整理した印象。
- Slack / Discord 両対応、metadata の設計が厚く routing と tool 連携に効いている。
- Slack threads と reaction ack の扱いが実運用寄り。

## 主要実装ファイル
- bus types: `repos/_claw/picoclaw/pkg/bus/types.go`
- bus runtime: `repos/_claw/picoclaw/pkg/bus/bus.go`
- channel base: `repos/_claw/picoclaw/pkg/channels/base.go`
- channel manager: `repos/_claw/picoclaw/pkg/channels/manager.go`
- Slack channel: `repos/_claw/picoclaw/pkg/channels/slack.go`
- Discord channel: `repos/_claw/picoclaw/pkg/channels/discord.go`
- agent bridge: `repos/_claw/picoclaw/pkg/agent/loop.go`
- config: `repos/_claw/picoclaw/pkg/config/config.go`

## 全体アーキテクチャ

### bus + manager
- `pkg/channels/base.go` の `HandleMessage` が inbound を bus publish。
- `pkg/channels/manager.go` が各 channel を初期化・起動し、outbound を `msg.Channel` で dispatch。
- `pkg/agent/loop.go` は bus inbound を消費して agent を起動し、shared message tool から outbound を再送できる。

### metadata 設計（強み）
- `account_id`, `peer_kind`, `peer_id`, `guild_id`, `team_id`, `message_ts`, `thread_ts` などを metadata に保持。
- `agent/loop.go` の route 解決が metadata 依存で整理されており、channel-specific 分岐を抑えやすい。

## Slack 実装

### transport / events
- `slack-go/slack` + `socketmode` による Socket Mode。
- Events API (`message`, `app_mention`) と slash command / interactive ack を扱う。

### threading / identity
- `chatID = channelID/threadTS` 形式で thread を会話IDへ埋め込む。
- `parseSlackChatID()` を outbound で逆変換し、thread reply を正確に送れる。

### UX / metadata
- trigger message に `eyes` reaction を付与。
- pending ack を持ち、送信完了時に `white_check_mark` へ更新。
- attachments と optional audio transcription を統合。
- `peer_kind`, `peer_id`, `team_id` を metadata に格納して agent/tool 側へ渡す。

## Discord 実装

### transport
- `discordgo` を使用。
- DMs と guild channels を扱う。

### preflight / trigger policy
- allowlist を先にチェック。
- guild では `MentionOnly` 設定が可能、DM は常時応答。

### UX / media
- attachments 取り込みと optional audio transcription。
- per-chat typing goroutine。
- 2000文字 chunking の outbound。

## Notable ideas
- Slack thread を `chatID` にエンコードする設計が単純かつ堅牢。
- metadata を中心に route/peer 情報を統一することで、多チャネル routing の拡張がしやすい。
- Slack slash / interactive を導入しつつ、OpenClawほど複雑にしないバランスが良い。

## 留意点
- OpenClaw のような高度な pairing / route preflight / streaming draft は未実装。
- channel logic と tool/agent metadata の整合に依存するため、schema の変更管理が重要。
