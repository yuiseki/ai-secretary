# OpenClaw と派生プロジェクトにおける Agentic Communication（Slack/Discord中心）アーキテクチャ調査（公開版）

調査日: 2026-02-22  
公開編集日: 2026-02-22

## 1. 調査スコープ
本レポートは、`openclaw` を基準に、派生・比較対象として以下を調査した。

- `openclaw`
- `nanobot`
- `picoclaw`
- `zeroclaw`
- `ironclaw`
- `mimiclaw`
- `nanoclaw`
- `tinyclaw`
- `safeclaw`（比較対象）
- `penny`（比較対象）

主眼は、Slack / Discord を通じてエージェントがユーザーとやりとりする際の以下である。

- inbound transport（どう受けるか）
- preflight / authz / allowlist / pairing（誰を通すか）
- session/thread routing（どの会話文脈へ流すか）
- agent dispatch bridge（LLM/agent実行系への橋渡し）
- outbound delivery / typing / progress UX（どう返すか）
- interactive surfaces（slash command / buttons / modals）
- resilience（再接続・重複抑制・rate limit対応）

## 2. エグゼクティブサマリー
OpenClaw 系の communication 設計は、大きく次の8系統に分かれる。

1. **リッチなチャネル実装を内蔵する統合型**
- 代表: `openclaw`
- Slack/Discord をそれぞれ専用 monitor/provider で厚く実装し、共通 plugin runtime と接続する。
- allowlist / pairing / route / thread / native command / streaming UX まで統合されている。

2. **Message Bus 中心のチャネルアダプタ型（軽量）**
- 代表: `nanobot`, `picoclaw`
- チャネルは inbound/outbound adapter に徹し、agent loop とは bus で接続する。
- 実装が追いやすく移植しやすい。

3. **Trait + Supervisor による汎用チャネル runtime 型**
- 代表: `zeroclaw`
- `Channel` trait に送受信/typing/draft更新を抽象化し、共通 dispatch loop が各チャネルを監督する。
- Discord/Slack 実装差は trait の内部へ閉じ込める。

4. **File Queue によるプロセス分離型**
- 代表: `tinyclaw`
- Discord client は DM 入出力をファイル queue に流すだけ。
- queue processor が agent/team orchestration を担当する。

5. **Skill（コード変換）でチャネルを追加する拡張型**
- 代表: `nanoclaw`
- runtime plugin ではなく、skill package がコードを差し替えて Discord チャネルを追加する。
- “channel support = repeatable code transformation” という別方向の拡張戦略。

6. **Framework-style channel abstraction 型**
- 代表: `penny`
- `MessageChannel` 抽象クラスが event handling / typing / agent call / response send を共通化。
- Discord はその具体実装の一つ。

7. **Capability/Registry 先行の WASM channel 構想型**
- 代表: `ironclaw`
- `registry/channels/*.json` と capabilities manifest を用意し、WASM channels を設計上の拡張点にしている。
- 現時点では Slack/Discord runtime 実装は完全には揃っていない（設計先行）。

8. **Webhook 送信ユーティリティ型（会話ボットではない）**
- 代表: `safeclaw`
- Slack/Discord は通知先 webhook として扱う。
- 会話セッション管理・対話 routing ではなく automation action の delivery レイヤ。

## 3. まず答え: Slack/Discord での「ユーザーとのやりとり」の仕組み

### 3.1 共通パターン（多くの実装で共通）
実装差はあるが、ほぼ全てのプロジェクトで以下の流れに収束している。

1. **チャネルから event/message を受信**
- Discord Gateway（WebSocket）
- Slack Socket Mode（WebSocket）または HTTP Events / Web API polling

2. **preflight で落とす/通す判定**
- self/bot message filter
- allowlist / group policy / DM policy
- mention-only mode（guild/groupで明示メンション時のみ応答）
- pairing（DM利用者の承認フロー）

3. **session key / thread key を解決**
- 例: `channel:chat_id`, `guild/channel/thread`, `channelID/threadTS`
- thread reply か新規 reply かをここで決める

4. **agent runtime へ橋渡し**
- message bus publish
- direct callback / agent loop call
- queue file write
- shared dispatch loop（trait runtime）

5. **typing / ack / status indicator を出す（任意）**
- Discord typing endpoint
- Slack reaction / draft stream / indicator

6. **outbound reply を chunking + thread routing して送信**
- Discord 2000文字制限の分割
- Slack thread_ts 指定
- metadata を使った返信先復元

### 3.2 どこに設計差が出るか
- **OpenClaw**: preflight と routing が非常に厚く、native command / interactive UI / streaming まである
- **NanoBot/PicoClaw**: bus 中心で見通しが良い、機能は必要十分
- **ZeroClaw**: channel trait と共通 dispatch loop の分離が美しい
- **TinyClaw**: チャネルと agent をプロセス分離して運用しやすい
- **NanoClaw**: runtime plugin ではなく skill でコード増設する点が独特

## 4. 比較表（要点）

### 4.1 Slack / Discord 実装成熟度
| Project | Slack | Discord | 実装成熟度 | 備考 |
|---|---|---|---|---|
| OpenClaw | あり（厚い） | あり（厚い） | 最高 | native commands / interactive / streaming / pairing / routing まで統合 |
| NanoBot | あり | あり | 高（軽量） | bus中心、Socket Mode + manual Discord gateway |
| PicoClaw | あり | あり | 高（軽量実用） | bus + metadata設計が実用的 |
| ZeroClaw | あり | あり | 中〜高 | trait runtime 良設計、Slackはpolling方式 |
| TinyClaw | なし | あり（DM） | 中 | file queue 分離が主題 |
| Penny | なし（Signalあり） | あり（単一channel） | 中 | framework比較対象 |
| NanoClaw | docs/skill構想 | skillで追加（Discord） | 低〜中 | base repo本体では固定実装薄い |
| IronClaw | registry/capabilities | registry/capabilities | 設計先行 | WASM channels 構想、runtime未充足 |
| SafeClaw | webhook送信のみ | webhook送信のみ | 別カテゴリ | 会話チャネルではない |
| Mimiclaw | なし | なし | 別カテゴリ | Telegram + WebSocket 中心 |

### 4.2 Inbound transport と event 取得方式
| Project | Slack inbound | Discord inbound | 特徴 |
|---|---|---|---|
| OpenClaw | Slack Bolt（Socket Mode / HTTPReceiver） | Discord gateway client（`@buape/carbon`） | transport選択肢が多い |
| NanoBot | Slack Socket Mode | manual Discord Gateway WS | 依存を薄くしつつ制御しやすい |
| PicoClaw | Slack Socket Mode (`socketmode`) | `discordgo` | 実装量と安定性のバランス |
| ZeroClaw | Web API polling (`conversations.history`) | manual Discord Gateway WS | Slackだけ polling なのが特徴 |
| TinyClaw | - | `discord.js` | DM client と queue bridgeに特化 |
| Penny | - | `discord.py` | 単一channel監視 |

### 4.3 Routing / Session / Thread 管理
| Project | Session識別 | Thread保持 | Routingの厚さ |
|---|---|---|---|
| OpenClaw | route + sessionKey + thread-aware key | Slack/Discord 両方で高度 | 非常に厚い（guild/DM/thread/forum/roles/pairing） |
| NanoBot | `channel:chat_id` | Slack `thread_ts` / Discord metadata | 薄く明快 |
| PicoClaw | bus metadata + peer fields | Slack `channel/threadTS` / Discord metadata | 中（metadata設計が良い） |
| ZeroClaw | `ChannelMessage` + `reply_target` + `thread_ts` | Slackは明示、Discordは主にchannel | 共通 trait に吸収 |
| TinyClaw | queue file metadata + pending map | DMのみ（threadほぼ不要） | channel clientよりqueue側中心 |
| Penny | channel message object + DB logging | 基本 channel threadless | 単一channel前提で薄い |

### 4.4 UX 機能（typing / ack / interactive）
| Project | Typing | Ack/Reactions | Native Commands / UI | Streaming/draft |
|---|---|---|---|---|
| OpenClaw | あり | あり | Slack slash+blocks+modals / Discord slash+components+modals | あり（Slack/Discordで進捗表現） |
| NanoBot | あり | Slack `eyes` | なし（基本テキスト） | なし |
| PicoClaw | あり | Slack `eyes`→`white_check_mark` | Slack slash / interactive ack あり | なし（主にtyping+metadata） |
| ZeroClaw | あり（trait hook） | 限定 | なし（現在） | trait上はdraft update抽象あり |
| TinyClaw | なし（簡易） | なし | DM内ローカル command (`/agent` 等) | なし |
| Penny | あり | reaction入力をイベント化 | channel commandは base handling 側 | なし |

### 4.5 拡張戦略の比較
| Project | 拡張単位 | 戦略 |
|---|---|---|
| OpenClaw | runtime plugin + channel dock + provider | 実行時プラグイン統合 |
| NanoBot | class + channel manager | シンプル継承/登録 |
| PicoClaw | struct + manager + metadata | Go実装の明示的分岐 |
| ZeroClaw | trait impl | compile-time trait polymorphism |
| TinyClaw | queue protocol + separate process | channel/agent 分離 |
| NanoClaw | skill package（コード変換） | 反復可能なコード生成/patch |
| IronClaw | registry + WASM capabilities | sandbox化/宣言的拡張（構想先行） |

## 5. OpenClaw 深掘り（基準実装）

### 5.1 全体構成
OpenClaw は、Slack/Discord 実装を単なる bot adapter に留めず、channel runtime の一部として統合している。

中核ファイル:

- channel lifecycle manager: `repos/_claw/openclaw/src/gateway/server-channels.ts`
- runtime plugin exports: `repos/_claw/openclaw/src/plugins/runtime/index.ts`
- channel capability metadata: `repos/_claw/openclaw/src/channels/dock.ts`
- channel plugin outbound/normalize/actions:
  - `repos/_claw/openclaw/src/channels/plugins/outbound/slack.ts`
  - `repos/_claw/openclaw/src/channels/plugins/outbound/discord.ts`
  - `repos/_claw/openclaw/src/channels/plugins/normalize/slack.ts`
  - `repos/_claw/openclaw/src/channels/plugins/normalize/discord.ts`
  - `repos/_claw/openclaw/src/channels/plugins/slack.actions.ts`
  - `repos/_claw/openclaw/src/channels/plugins/actions/discord.ts`

`server-channels.ts` は channel/account ごとの runtime status を管理し、start/stop/restart（backoff付き）を扱う。ここがあるため、Slack/Discord monitor は「個別実装」でありながら運用上は同一の監督面で扱える。

### 5.2 Slack 実装の流れ（OpenClaw）

主要ファイル:

- provider: `repos/_claw/openclaw/src/slack/monitor/provider.ts`
- event registration: `repos/_claw/openclaw/src/slack/monitor/events.ts`
- message events: `repos/_claw/openclaw/src/slack/monitor/events/messages.ts`
- interactions: `repos/_claw/openclaw/src/slack/monitor/events/interactions.ts`
- inbound handler: `repos/_claw/openclaw/src/slack/monitor/message-handler.ts`
- preflight: `repos/_claw/openclaw/src/slack/monitor/message-handler/prepare.ts`
- dispatch: `repos/_claw/openclaw/src/slack/monitor/message-handler/dispatch.ts`
- reply delivery: `repos/_claw/openclaw/src/slack/monitor/replies.ts`
- native slash command: `repos/_claw/openclaw/src/slack/monitor/slash.ts`

#### transport / provider
- Slack Bolt `App` を使い、**Socket Mode** と **HTTPReceiver** の両方をサポート。
- mode に応じて必要 secret/token の検証が分岐。
- 複数 account を解決し、allowlist の name -> ID 解決を非同期に行って runtime config を補正する。
- HTTP mode では webhook path 登録、Socket mode では socket session を開始する。

#### inbound event handling
- `message` / `app_mention` を処理し、edit/delete/thread_broadcast を system event として queue に積める。
- reaction/member/channel/pin/interaction も monitor に統合されている。
- Slack の interactive payload（block actions / modal submit）も同じ monitor 配下で処理される。

#### preflight（ここが重要）
`prepare.ts` で以下をまとめて判定・整形している。

- channel type / channel config の解決
- bot message 許可/拒否（`allowBots`）
- group policy / channel allowlist
- DM policy（`open` / `pairing` / `disabled`）と pairing request フロー
- route 解決（agent routing）
- thread-aware session key 解決（thread reply と通常会話の分離）
- mention 要件判定（thread内 reply の bypass 含む）
- command gating / user allowlist

この時点で「実際に agent に渡してよいか」の判断がほぼ終わるため、後段がシンプルになる。

#### dispatch / reply
- auto-reply engine に渡しつつ、typing/status indicator callback を接続。
- DM では `lastRoute` 更新により次回 routing を補助。
- `replyToMode`（`off/first/all`）に応じて thread reply 先を計画。
- streaming preview（draft append / fallback send）に対応。
- Slack 特有の ack reaction 取り外しや prefixing を扱う。

#### native slash / interactive UI
- `slash.ts` が command registry と接続され、arg menus / buttons / authorization / pairing まで含む。
- slash 応答は `response_url` を使った multi-part reply に対応。
- block actions/modals が message event と同じ世界の system events に合流できる。

### 5.3 Discord 実装の流れ（OpenClaw）

主要ファイル:

- provider: `repos/_claw/openclaw/src/discord/monitor/provider.ts`
- listeners: `repos/_claw/openclaw/src/discord/monitor/listeners.ts`
- message entry: `repos/_claw/openclaw/src/discord/monitor/message-handler.ts`
- preflight: `repos/_claw/openclaw/src/discord/monitor/message-handler.preflight.ts`
- processing: `repos/_claw/openclaw/src/discord/monitor/message-handler.process.ts`
- final delivery: `repos/_claw/openclaw/src/discord/monitor/reply-delivery.ts`
- native commands/components: `repos/_claw/openclaw/src/discord/monitor/native-command.ts`

#### transport / provider
- `@buape/carbon` ベースの Discord client runtime を構築。
- multi-account config 解決、token 検証、allowlist の slug/name -> ID 解決、guild/channel/user allowlist 補正を実施。
- native slash command の有効化・dedupe・上限制御を行い、components/modals/voice manager/exec approvals handler を組み込む。
- gateway plugin 登録と abort handling、HELLO timeout の zombie reconnect 対策を持つ。
- gateway stop 時のエラー（例: intents 設定不一致）を明示処理する。

#### inbound listeners
- message / reaction / presence listener に slow-listener logging を入れている。
- reaction event は system event に変換可能で、会話以外の UI 操作も agent 側に伝搬できる。

#### preflight（Discord版）
`message-handler.preflight.ts` で以下をまとめて処理する。

- self message / bot message filter（`allowBots`）
- PluralKit sender identity 解決
- DM / group DM / guild / thread の判定
- DM pairing フロー（pairing allowlist store）
- guild/member roles を加味した route 解決
- mention required 判定（`mention_only` 相当）
- channel/guild allowlist と group policy
- command authorization
- channel activity / system event 抽出

Slack同様、agent に渡す前の準備と拒否判定を一箇所に寄せている。

#### process / delivery
- media extraction、ack/status reactions、typing 制御を行いながら inbound envelope を構築。
- forum/thread context と session routing を処理。
- auto-reply + tool loop を回し、最終送信は `reply-delivery.ts` に集約。
- chunking（2000文字制限）、reply mode、draft streaming、timeout/error handling をチャネル側で吸収。

#### native interactions
- native slash command + component + modal を rich に実装。
- model picker や command registry 連携まで monitor 配下で管理している。

### 5.4 OpenClaw の中核アイデア（通信レイヤ）
- **preflight を厚くする**ことで、agent loop 側にチャネル固有の枝分かれを持ち込まない。
- **thread/session routing をチャネル入力段階で確定**し、後段の memory/session 層を安定化する。
- **interactive UI と message event を同じ system event 世界へ寄せる**ことで、機能追加コストを下げる。
- **outbound/normalize/actions を plugin 層で分離**し、agent tool からのチャネル操作を制御可能にする。

## 6. 派生プロジェクト分析（通信アーキテクチャの観点）

### 6.1 NanoBot（Python, bus最小構成）

主要ファイル:

- bus types: `repos/_claw/nanobot/nanobot/bus/events.py`
- bus queue: `repos/_claw/nanobot/nanobot/bus/queue.py`
- channel base/manager:
  - `repos/_claw/nanobot/nanobot/channels/base.py`
  - `repos/_claw/nanobot/nanobot/channels/manager.py`
- Slack: `repos/_claw/nanobot/nanobot/channels/slack.py`
- Discord: `repos/_claw/nanobot/nanobot/channels/discord.py`
- agent bridge: `repos/_claw/nanobot/nanobot/agent/loop.py`

特徴:

- `InboundMessage` / `OutboundMessage` を bus に流し、agent loop は channel 非依存で動く。
- `session_key = f"{channel}:{chat_id}"` が単純で分かりやすい。
- outbound metadata を保持するので、Slack `thread_ts` / Discord `reply_to` などの channel-specific 情報を失わない。

Slack:

- Socket Mode で event を受ける。
- `message` / `app_mention` を処理、ack を即返す。
- group policy（`open/mention/allowlist`）と DM policy（`open/allowlist`）をサポート。
- `eyes` reaction で処理中フィードバック。
- optional `reply_in_thread` に対応。

Discord:

- manual Gateway WS 実装（HELLO/IDENTIFY/heartbeat/reconnect）。
- outbound は REST API、typing endpoint を直接叩く。
- 429 retry、2000文字分割あり。
- attachment をローカル保存して content placeholder 化。

設計上の学び:

- transport 実装を各 channel に閉じ込め、agent loop は bus のみを見る構成は保守しやすい。
- metadata pass-through を最初から設計している点が重要（threading / reply / guild context の取り回しが楽）。

### 6.2 PicoClaw（Go, bus + metadata実用型）

主要ファイル:

- bus: `repos/_claw/picoclaw/pkg/bus/types.go`, `repos/_claw/picoclaw/pkg/bus/bus.go`
- channel base/manager:
  - `repos/_claw/picoclaw/pkg/channels/base.go`
  - `repos/_claw/picoclaw/pkg/channels/manager.go`
- Discord: `repos/_claw/picoclaw/pkg/channels/discord.go`
- Slack: `repos/_claw/picoclaw/pkg/channels/slack.go`
- agent bridge: `repos/_claw/picoclaw/pkg/agent/loop.go`

特徴:

- NanoBot系の bus 設計を Go で整理した印象。
- metadata を厚めに持ち、route 解決や tool 送信で再利用する。
- `peer_kind` / `peer_id` / `guild_id` / `team_id` の導入が実用的。

Slack:

- Socket Mode + Events API + slash commands + interactive ack を扱う。
- `chatID = channelID/threadTS` で thread を session identity にエンコード。
- `eyes` reaction を pending ack として持ち、送信後に `white_check_mark` へ更新。
- attachments と音声転写（設定時）を統合。

Discord:

- `discordgo` 利用。
- guild では `MentionOnly`、DM では常時応答。
- attachments と音声転写（設定時）を処理。
- per-chat typing goroutine を持つ。
- outbound 2000文字分割。

設計上の学び:

- **metadata を中心に route/peer 情報を持ち回る**設計は、多チャネル化で効く。
- Slack thread を `chatID` に埋め込む手法はシンプルでバグりにくい。

### 6.3 ZeroClaw（Rust, trait-based multi-channel runtime）

主要ファイル:

- channel trait: `repos/_claw/zeroclaw/src/channels/traits.rs`
- channel runtime: `repos/_claw/zeroclaw/src/channels/mod.rs`
- Discord channel: `repos/_claw/zeroclaw/src/channels/discord.rs`
- Slack channel: `repos/_claw/zeroclaw/src/channels/slack.rs`
- config: `repos/_claw/zeroclaw/src/config/schema.rs`

特徴:

- `Channel` trait が `send/listen/typing/draft_update/health_check` を抽象化。
- 共通 runtime (`channels/mod.rs`) が listener supervision、dispatch parallelism、typing refresh、draft更新、memory/provider/tool 連携を担当。
- `ChannelMessage` / `SendMessage` が thread delivery を抽象化（`thread_ts` を持てる）。

Discord:

- manual Gateway WS + REST のハイブリッド。
- `/gateway/bot` 取得、heartbeat、reconnect、invalid session 対応。
- `mention_only`、guild filter、allowed_users を実装。
- typing は REST `/typing`。
- outbound は 2000文字分割。

Slack:

- polling型（`conversations.history` を定期呼び出し）。
- fixed `channel_id` を listen 対象にする簡素なモデル。
- `auth.test` で bot user id を取得し self-filter。
- `last_ts` 管理で差分取得。
- `thread_ts` を保って outbound `chat.postMessage` に反映。

設計上の学び:

- **trait に draft update/typing を含める**と、channelごとの差を runtime 側で吸収しやすい。
- Slack を polling で割り切る実装は低依存・運用簡素だが、イベント豊富さは犠牲になる。

### 6.4 TinyClaw（Discord DM + file queue 分離）

主要ファイル:

- `repos/_claw/tinyclaw/src/channels/discord-client.ts`
- `repos/_claw/tinyclaw/src/queue-processor.ts`
- `repos/_claw/tinyclaw/docs/QUEUE.md`

特徴:

- Discord DM client は inbound/outbound をファイル queue に変換する「薄い adapter」。
- queue processor が agent/team routing と AI 実行を担当し、チャネル接続と知能処理をプロセス分離している。
- DM client 側に pairing（`ensureSenderPaired`）とローカル command（`/agent`, `/team`, `/reset`）を置く。
- Discord 2000文字 chunking と `pendingMessages` による相関管理を実装。

学び:

- channel runtime の不安定性と agent 実行負荷を分離したい場合、file queue は実装コストに対して効果が高い。
- OpenClaw のような統合型とは逆方向だが、運用復旧のしやすさは高い。

### 6.5 NanoClaw（skill-driven channel extension）

主要ファイル:

- `repos/_claw/nanoclaw/src/types.ts`
- `repos/_claw/nanoclaw/src/index.ts`
- `repos/_claw/nanoclaw/.claude/skills/add-discord/add/src/channels/discord.ts`
- `repos/_claw/nanoclaw/.claude/skills/add-discord/modify/src/index.ts`

特徴:

- base runtime は抽象 `Channel` interface を持つが、Discord/Slack を固定実装として内蔵しない。
- `add-discord` skill がコード追加/修正パッチとして Discord support を導入する。
- `discord.js` 実装側で mention 変換、attachment placeholder、reply context、group登録チェック、typing、2000文字 chunking を扱う。

学び:

- runtime plugin ではなく「再利用可能な patch」としてチャネル追加を配布する方法がある。
- 組織内でチャネル拡張の標準手順を共有したい場合に相性が良い。

### 6.6 Penny（framework-style Discord channel abstraction）

主要ファイル:

- `repos/_claw/penny/penny/penny/channels/base.py`
- `repos/_claw/penny/penny/penny/channels/discord/channel.py`
- `repos/_claw/penny/penny/penny/channels/discord/models.py`

特徴:

- `MessageChannel` base class が event normalize -> command/reaction handling -> typing -> agent -> DB logging -> response send を共通 pipeline として提供。
- Discord は `discord.py` を使う単一 configured channel 前提の実装。
- `on_reaction_add` を入力イベント化して軽量 UI 操作に使える。

学び:

- 多チャネル runtime よりも、アプリ内 framework として channel pipeline を共通化する設計は保守しやすい。
- OpenClaw のような multi-account/guild routing が不要な場面では十分実用的。

### 6.7 SafeClaw（webhook delivery 特化）

主要ファイル:

- `repos/_claw/safeclaw/src/safeclaw/triggers/webhook.py`

特徴:

- Slack/Discord は会話チャネルではなく webhook 通知先。
- SSRF 対策・HMAC 付きの generic webhook sender と `send_to_slack()` / `send_to_discord()` を持つ。

学び:

- 会話チャネル層とは別に webhook delivery 層を分離する設計は、cron/automation 通知の安全化に有効。

### 6.8 Mimiclaw（Telegram/WebSocket 中心、Slack/Discord未実装）

主要ファイル:

- `repos/_claw/mimiclaw/main/telegram/telegram_bot.c`
- `repos/_claw/mimiclaw/main/gateway/ws_server.c`
- `repos/_claw/mimiclaw/main/agent/agent_loop.c`

特徴:

- 本調査時点で Slack/Discord runtime channel は見当たらない。
- 通信面の主題は Telegram bot と WebSocket gateway。
- それでも、agent loop への注入境界を揃える設計は他派生との比較対象になる。

## 7. 設計先行/構想系の位置づけ

### 7.1 IronClaw（WASM channel の宣言的設計）

主要ファイル:

- channel registry:
  - `repos/_claw/ironclaw/registry/channels/slack.json`
  - `repos/_claw/ironclaw/registry/channels/discord.json`
- capabilities:
  - `repos/_claw/ironclaw/channels-src/slack/slack.capabilities.json`
  - `repos/_claw/ironclaw/channels-src/discord/discord.capabilities.json`
- docs/status:
  - `repos/_claw/ironclaw/README.md`
  - `repos/_claw/ironclaw/FEATURE_PARITY.md`

特徴:

- チャネルを WASM パッケージとして registry 登録し、capabilities manifest で権限・rate limit・callback timeout を宣言する構想。
- auth secret 名、allowed webhook path、callback 予算などを先に定義できる。
- communication 実装の「何を許すか」を runtime code ではなく manifest に寄せる思想が強い。

現状評価:

- Slack/Discord の registry/capability ファイルは存在し、設計意図は読み取れる。
- ただし `FEATURE_PARITY.md` ベースでは runtime 実装の充足度に差があり、OpenClaw のような会話フル機能には未到達。

学び:

- OpenClaw の plugin runtime をさらに sandbox 化/宣言化したい場合、IronClaw の manifest-first アプローチは有力。

## 8. 中核アイデアの抽出（再実装に効く形）

### 8.1 preflight を channel adapter の責務として厚く持つ
OpenClaw が最も顕著だが、allowlist / pairing / mention / route / thread session をチャネル入力側で決めると、agent loop の複雑性が大きく下がる。

### 8.2 metadata pass-through は最初から設計する
NanoBot / PicoClaw のように inbound metadata を outbound まで保つと、thread reply・reaction ack・peer routing・guild context を後から足しやすい。

### 8.3 thread を session identity にどう写像するかを明示する
- Slack: `thread_ts` を独立フィールドで持つか、`chatID` に埋め込むか
- Discord: channel/thread/forum/reply_to をどう key 化するか

この選択が memory/session/caching の挙動を左右する。

### 8.4 typing / ack / progress は UX だけでなく運用信号
処理時間が長い agent では、typing や reaction ack がないと「固まった」と誤解される。OpenClaw/PicoClaw/NanoBot はここを重視している。

### 8.5 interactive surfaces は system event へ正規化すると拡張しやすい
OpenClaw のように slash commands / buttons / modals を system events と同居させると、agent 側の分岐が増えにくい。

### 8.6 拡張戦略は runtime plugin だけではない
- runtime plugin（OpenClaw）
- trait impl（ZeroClaw）
- file queue protocol（TinyClaw）
- code transformation skill（NanoClaw）
- capability manifest + WASM（IronClaw）

どれを選ぶかは、配布形態・安全性・カスタマイズ頻度で決まる。

## 9. 再実装のための実践的ブループリント（Slack/Discord）

### 9.1 MVP 構成（まず動く）
1. `ChannelAdapter`（Slack/Discord別）
2. `InboundMessage` / `OutboundMessage` 共通型（metadata付き）
3. `MessageBus`（または queue）
4. agent loop（channel 非依存）
5. outbound chunking + thread reply

この段階では NanoBot/PicoClaw 型が最短。

### 9.2 実運用構成（次に必要になる）
- allowlist / group policy / mention-only
- typing / ack reaction
- retry / reconnect / rate limit handling
- thread-aware session key
- slash/native command（最低限）

### 9.3 上位機能（OpenClaw級へ）
- DM pairing フロー
- channel plugin actions（toolからの安全な送信/編集/リアクション）
- interactive UI（buttons/modals/components）
- streaming preview / draft updates
- channel lifecycle supervisor（restart/backoff/manual stop）

## 10. 結論
Slack/Discord を通じた agent-user communication 実装で、OpenClaw 系から抽出できる本質は次の4点に収束する。

1. **入力段階で通行制御と routing を完了させる**（preflight厚め）  
2. **session/thread identity を曖昧にしない**（metadata設計を先に決める）  
3. **agent runtime とは bus/queue/trait で疎結合にする**（transport差分を隔離）  
4. **UX信号（typing/ack/interactive）を通信設計の一部として扱う**（長処理の体感品質を守る）

OpenClaw は最も完成度が高い統合実装であり、NanoBot/PicoClaw/ZeroClaw/TinyClaw/NanoClaw はそれぞれ異なる制約下での優れた設計解を示している。再実装では「OpenClaw を全面コピー」よりも、目的に応じてこれらの設計パターンを組み合わせる方が現実的である。

---

## 付録: 関連ドキュメント（公開版）

- `AGENTIC_COMMUNICATION.md`（本レポート）
- `projects/openclaw.md`
- `projects/nanobot.md`
- `projects/picoclaw.md`
- `projects/zeroclaw.md`
- `projects/ironclaw.md`
- `projects/mimiclaw.md`
- `projects/nanoclaw.md`
- `projects/tinyclaw.md`
- `projects/safeclaw.md`
- `projects/penny.md`
