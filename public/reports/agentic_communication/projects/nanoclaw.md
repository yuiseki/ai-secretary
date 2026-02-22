# NanoClaw

## Quick facts
- base runtime は抽象 `Channel` インターフェースでチャネルを扱うが、Discord/Slack 実装を本体に固定で内蔵していない。
- 特色は、チャネル追加を runtime plugin ではなく **skill package（コード変換）** で行う点。
- 現在の repo では `add-discord` スキルが具体実装として存在する。

## 主要実装ファイル
- channel interface/types: `repos/_claw/nanoclaw/src/types.ts`
- runtime wiring entry: `repos/_claw/nanoclaw/src/index.ts`
- Discord 追加スキル:
  - `repos/_claw/nanoclaw/.claude/skills/add-discord/SKILL.md`
  - `repos/_claw/nanoclaw/.claude/skills/add-discord/manifest.yaml`
  - `repos/_claw/nanoclaw/.claude/skills/add-discord/add/src/channels/discord.ts`
  - `repos/_claw/nanoclaw/.claude/skills/add-discord/modify/src/index.ts`
- docs:
  - `repos/_claw/nanoclaw/docs/REQUIREMENTS.md`
  - `repos/_claw/nanoclaw/docs/nanoclaw-architecture-final.md`

## base runtime の通信アーキテクチャ

### `Channel` interface（`src/types.ts`）
- `connect`
- `sendMessage`
- `isConnected`
- `ownsJid`
- `disconnect`
- optional `setTyping`

callback として `OnInboundMessage` / `OnChatMetadata` を受ける設計で、チャネル側は runtime へ message を押し込める。

### runtime wiring（`src/index.ts`）
- 複数 channel を `channels[]` で保持。
- `findChannel(channels, jid)` で outbound ルーティング。
- channel-specific 実装は `channelOpts` callback を通じて同じ形で統合される。

## Discord 追加スキル（`add-discord`）のアプローチ

### 何がユニークか
- Discord サポートを「プラグインとしてロード」するのではなく、skill が **コードを追加/修正** して本体へ組み込む。
- つまり、チャネル拡張を runtime 機構ではなく *再現可能な patch* として管理している。

### 実装内容（`add/src/channels/discord.ts`）
- `discord.js` の `MessageCreate` を利用。
- Discord mention を NanoClaw 内部の trigger format（`@ASSISTANT_NAME`）へ変換。
- attachments placeholder、reply context prefix、metadata 保存。
- `registeredGroups()` callback を用いた許可グループのみ処理。
- `sendMessage()` で 2000文字 chunking。
- `setTyping()` サポート。

### runtime への統合（`modify/src/index.ts`）
- `src/index.ts` に DiscordChannel 生成/接続/ルーティングを差し込む patch を提供。
- skill 適用後に初めて Discord が base runtime の正式 channel として動く。

## 再実装での参考点
- カスタマイズ頻度が高いプロジェクトでは、runtime plugin より skill-driven code transformation の方が運用しやすい場合がある。
- 「チャネル追加手順」そのものを再利用可能 artifact にする発想は、チーム展開に向く。

## 留意点
- 本体 repo の現状だけを見ると Slack/Discord runtime 実装の成熟度を過大評価しやすい（Discord は skill package 側にある）。
- 実行時ロード型より柔軟性は低く、適用後コードの差分管理が重要。
