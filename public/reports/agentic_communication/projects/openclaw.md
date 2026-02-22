# OpenClaw

## Quick facts
- Slack / Discord の両方を本格実装している基準プロジェクト。
- channel runtime supervisor + plugin runtime + channel-specific monitor/provider の三層構成。
- preflight（allowlist/pairing/routing/thread/session）と native interactive UI が非常に厚い。

## 主要実装ファイル
- channel lifecycle supervisor: `repos/_claw/openclaw/src/gateway/server-channels.ts`
- runtime plugin exports: `repos/_claw/openclaw/src/plugins/runtime/index.ts`
- channel capability metadata: `repos/_claw/openclaw/src/channels/dock.ts`
- Slack monitor:
  - `repos/_claw/openclaw/src/slack/monitor/provider.ts`
  - `repos/_claw/openclaw/src/slack/monitor/events.ts`
  - `repos/_claw/openclaw/src/slack/monitor/events/messages.ts`
  - `repos/_claw/openclaw/src/slack/monitor/events/interactions.ts`
  - `repos/_claw/openclaw/src/slack/monitor/message-handler.ts`
  - `repos/_claw/openclaw/src/slack/monitor/message-handler/prepare.ts`
  - `repos/_claw/openclaw/src/slack/monitor/message-handler/dispatch.ts`
  - `repos/_claw/openclaw/src/slack/monitor/replies.ts`
  - `repos/_claw/openclaw/src/slack/monitor/slash.ts`
- Discord monitor:
  - `repos/_claw/openclaw/src/discord/monitor/provider.ts`
  - `repos/_claw/openclaw/src/discord/monitor/listeners.ts`
  - `repos/_claw/openclaw/src/discord/monitor/message-handler.ts`
  - `repos/_claw/openclaw/src/discord/monitor/message-handler.preflight.ts`
  - `repos/_claw/openclaw/src/discord/monitor/message-handler.process.ts`
  - `repos/_claw/openclaw/src/discord/monitor/reply-delivery.ts`
  - `repos/_claw/openclaw/src/discord/monitor/native-command.ts`
- outbound/normalize/actions:
  - `repos/_claw/openclaw/src/channels/plugins/outbound/slack.ts`
  - `repos/_claw/openclaw/src/channels/plugins/outbound/discord.ts`
  - `repos/_claw/openclaw/src/channels/plugins/normalize/slack.ts`
  - `repos/_claw/openclaw/src/channels/plugins/normalize/discord.ts`
  - `repos/_claw/openclaw/src/channels/plugins/slack.actions.ts`
  - `repos/_claw/openclaw/src/channels/plugins/actions/discord.ts`

## 全体アーキテクチャ

### channel runtime supervisor（`server-channels.ts`）
- channel/account 単位で start/stop/restart を管理。
- runtime status と restart attempt を追跡。
- backoff と manual-stop 抑止があり、運用中のチャネル再起動を統一的に扱える。

### plugin runtime integration
- `src/plugins/runtime/index.ts` が Slack/Discord monitor provider, outbound sender, resolver, action adapter を公開。
- channel 実装を core から直接呼ぶのではなく plugin runtime 経由にすることで、他機能との統合点を一本化している。

### channel capability metadata（`channels/dock.ts`）
- Discord/Slack の chat type / threads / nativeCommands / reactions / message chunk limits などの capability を保持。
- mention strip pattern や default resolver もここで定義でき、channel差分をデータで扱える。

## Slack 通信アーキテクチャ

### transport / startup
- `monitorSlackProvider()` は Slack Bolt を使い、Socket Mode と HTTPReceiver の両方をサポート。
- token / signing secret の検証を mode ごとに行う。
- account config と allowlist 名称解決（user/channel -> ID）を startup 時に行い、運用時の判定を軽くする。

### inbound events
- `message` / `app_mention` を中心に処理。
- edit/delete/thread_broadcast を system event として queue 化できる。
- reaction/member/channel/pin/interaction event も同じ monitor の管理下。

### preflight（最重要）
`message-handler/prepare.ts` が以下を一括担当する。

- channel type / channel policy 解決
- bot message filter（`allowBots`）
- channel/group allowlist
- DM policy と pairing request フロー
- route 解決（どの agent/team に渡すか）
- thread-aware session key 解決
- mention 必須判定（thread reply 時の例外含む）
- user allowlist / command gating

この構造により、後段の dispatch は「通過済みメッセージを処理する」ことに集中できる。

### dispatch / outbound UX
- typing/status indicator callback 付きで auto-reply engine を実行。
- DM の `lastRoute` を更新して次回の route 推定に使う。
- `replyToMode` に応じて thread reply 計画を切り替える。
- streaming preview（draft append / fallback send）に対応。
- ack reaction の除去、silent reply suppression（token）など運用UXが細かい。

### native commands / interactions
- `slash.ts` は slash command を command registry と接続し、arg menu, buttons, pairing, authz を扱う。
- `events/interactions.ts` は block actions / modal submit を処理。
- Slack UIイベントと message event を system event に寄せて統合している点が強い。

## Discord 通信アーキテクチャ

### transport / startup
- `monitorDiscordProvider()` が `@buape/carbon` ベースの runtime を構築。
- multi-account config を解決し、guild/channel/user allowlist の slug/name を ID に解決。
- native slash command の dedupe / 上限制御、components/modals/voice/exec approvals を provider 段階で組み込む。
- gateway plugin 登録、abort handling、HELLO timeout 対策、意図しない gateway stop のエラー処理まで持つ。

### inbound listeners
- message/reaction/presence を listener wrapper 経由で登録。
- slow-listener logging があり、channelイベント処理の詰まりを観測しやすい。
- reaction を system event 化できるため、リアクションベース操作も agent に伝えられる。

### preflight（Discord版）
`message-handler.preflight.ts` が以下を担当。

- self/bot message filter（`allowBots`）
- PluralKit sender identity 解決
- DM / group DM / guild / thread の判定
- DM pairing フロー
- guild/member roles を考慮した route 解決
- mention 要件判定
- channel/guild allowlist + group policy
- command authorization
- channel activity / system event 抽出

Slack と同様に、ここで通行制御と文脈解決を先に済ませる。

### process / delivery
- `message-handler.process.ts` が media extraction / typing / ack/status reaction / context構築 / auto-reply 実行を担当。
- forum/thread context を含めた session routing を扱う。
- 最終送信は `reply-delivery.ts` に集約し、chunking, media, voice, reply mode を吸収。
- timeouts / errors / draft streaming の扱いもチャネル側に寄せている。

### native interactions
- `native-command.ts` が slash command / components / modals を処理。
- command registry や model picker 連携まで monitor に含まれ、Discord をフル機能UIとして扱う設計。

## OpenClaw の通信設計から抽出できるアイデア
- preflight を厚くして agent runtime をチャネル差分から守る。
- channel lifecycle supervisor を持ち、restart/backoff を channel実装から分離する。
- outbound/normalize/actions を plugin 層に分解し、tool からのチャネル操作を安全化する。
- interactive UI を system event に正規化して message pipeline に接続する。

## 留意点
- 機能密度が高く、再実装で一気に追うと複雑になりやすい。
- Slack/Discord と routing/session/tooling の結合点が多いため、回帰テストが重要。
- MVP では NanoBot/PicoClaw 型から始め、必要箇所だけ OpenClaw の preflight/interactive を取り込む方が現実的。
