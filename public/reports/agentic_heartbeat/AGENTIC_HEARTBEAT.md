# OpenClaw と派生プロジェクトにおける Agentic Heartbeat / 定期実行アーキテクチャ調査（公開版）

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
- `penny`（比較対象、idle-aware scheduler の設計抽出目的）

補足:
- `nanoclaw` は `HEARTBEAT.md` ベースの heartbeat ではなく、SQLite 駆動の scheduled task 実装が中心。
- `safeclaw` / `penny` は OpenClaw 直系というより比較対象だが、再実装時の scheduler 設計の参考価値が高い。

## 2. エグゼクティブサマリー
OpenClaw 系の「定期実行」は、実装上つぎの4系統に分かれる。

1. **Heartbeat checklist 型（単一プロンプト再評価）**
- 代表: `openclaw`, `nanobot`, `picoclaw`, `mimiclaw`, `ironclaw`
- `HEARTBEAT.md` を読み、一定間隔で LLM を起こして点検させる。
- no-op 応答（`HEARTBEAT_OK`）を抑制して通知コストを下げる思想が強い。

2. **Cron / Scheduled Job 型（精密時刻トリガ）**
- 代表: `openclaw`, `nanobot`, `picoclaw`, `mimiclaw`, `zeroclaw`, `nanoclaw`, `tinyclaw`, `safeclaw`
- `at` / `every` / `cron` などを永続化し、 due 判定で実行。
- 実装差は「どこへ注入するか（main session / isolated / queue / direct callback）」に集中する。

3. **Routine Engine 型（Trigger/Action/Guardrail 一般化）**
- 代表: `ironclaw`（`routines`）
- cron だけでなく event / webhook / manual trigger を同じデータモデルに統合。
- guardrails・通知ポリシー・run log を一体化し、運用機能が厚い。

4. **Scheduler Policy 型（idle-aware background orchestration）**
- 代表: `penny`
- cron job だけでなく、複数の background agent を優先度順・idle 状態に応じて同一 scheduler で回す。
- “いつ走らせるか” の policy を抽象化している点が再実装に有用。

最重要の設計論点は以下。

- heartbeat と cron を **同一機構にしない**（責務分離し、必要な場所だけ接続する）
- cron の実行結果を main session に反映する際は **system event + wake** のブリッジにする
- no-op heartbeat の扱いを軽視しない（通知抑制・履歴汚染防止・セッション寿命の副作用対策）
- scheduler は長期運用で壊れる前提で、**re-arm / stale marker cleanup / backoff / replay** を入れる
- delivery（通知先）と execution（agent run）を分離しないと複雑化が暴走する

## 3. 用語整理（本レポート内）

- **Heartbeat**: 一定間隔で「状況確認・点検」のためにエージェントを起こす仕組み
- **Cron / Scheduled Job**: 時刻・周期に基づいて発火する個別ジョブ
- **Main Session Injection**: main 会話コンテキストに system event 等を入れて処理させる方式
- **Isolated Run**: cron 専用セッション/独立コンテキストで実行する方式
- **Delivery**: 実行結果をどこへ送るか（channel / webhook / none）
- **Wake**: heartbeat runner を即時または次回 tick で起こす要求

## 4. 比較表（要点）

### 4.1 Heartbeat 実装の比較
| Project | Heartbeat SoT | Tick方式 | 実行単位 | No-op判定 | 通知先解決 | 特徴 |
|---|---|---|---|---|---|---|
| OpenClaw | `HEARTBEAT.md` + queued system events | per-agent interval + wake queue | 1 heartbeat run（ただし cron/exec event で prompt切替） | `HEARTBEAT_OK` token + `ackMaxChars` + transcript prune + dedupe | `last` / explicit channel + `to` + `accountId` | 最も高機能。cron/exec と heartbeat を橋渡しする中核 |
| NanoBot | `HEARTBEAT.md` | asyncio sleep loop | 1 heartbeat prompt | `HEARTBEAT_OK` 文字列判定 | callback側実装依存 | シンプルで理解しやすい |
| PicoClaw | `HEARTBEAT.md`（missing時テンプレ生成） | ticker + 初回遅延 | 1 heartbeat prompt（NoHistory） | `HEARTBEAT_OK` exact + silent ToolResult | last channel state + message bus | no-history heartbeat / spawn 前提のプロンプト設計 |
| MimiClaw | `HEARTBEAT.md` | FreeRTOS timer | inbound message busへ1件注入 | 実質LLM側契約 | bus/agent 側 | 組込向け最小構成 |
| IronClaw | `HEARTBEAT.md` | tokio interval | 1 heartbeat LLM turn | `HEARTBEAT_OK` 判定 | response channel (optional) | memory hygiene を heartbeat tick に同居 |
| ZeroClaw | `HEARTBEAT.md`（bullet parse） | tokio interval（daemon worker） | **タスクごとに agent::run** | tasks emptyでskip | agent run後の通常出力 | checklist fan-out 型で OpenClaw とは意味が違う |
| TinyClaw | per-agent `heartbeat.md` | shell `while true; sleep` | queue に @agent メッセージ投入 | 実行系に委譲 | queue outgoing を heartbeat script が回収 | shell + queue + tmux の運用設計 |
| SafeClaw | なし（heartbeat概念は薄い） | - | - | - | - | 比較対象外 |
| NanoClaw | なし（scheduled task中心） | - | - | - | - | heartbeat非採用 |

### 4.2 Cron / 定期ジョブの比較
| Project | 永続化 | Schedule型 | 実行注入経路 | Delivery分離 | 信頼性機能 | 備考 |
|---|---|---|---|---|---|---|
| OpenClaw | JSON store + migration/repair | `at`/`every`/`cron` (+ stagger) | main system event or isolated agent run | `none`/`announce`/`webhook` | missed replay, backoff, stale marker cleanup, re-arm, min-refire-gap | もっとも堅牢 |
| NanoBot | JSON | `at`/`every`/`cron` | callback -> agent `process_direct` | payload内で簡易 | 基本的な next_run 再計算 | MVP向け |
| PicoClaw | JSON | `at`/`every`/`cron` | callback -> direct deliver / exec / agent run | tool層で兼務 | duplicate防止（nextRun nil化） | 実用ミニマル |
| MimiClaw | SPIFFS JSON + static array | `at`/`every` | inbound message bus | channel/chat_id フィールド | 組込向け簡易 | cron expr 非対応 |
| ZeroClaw | SQLite + run history | `Cron`/`At`/`Every`, shell/agent | scheduler loop -> shell or agent | announce channel delivery | retry/backoff, concurrency, run log retention | security policy 強い |
| IronClaw (Routines) | DB `routines` / `routine_runs` | cron/event/webhook/manual | routine engine -> lightweight/full-job | notify config | cooldown, per-routine concurrency, global cap | cronより上位抽象 |
| NanoClaw | SQLite `scheduled_tasks` | `cron`/`interval`/`once` | container agent queue | task execution path内 | group queue serialization, concurrency limit | group isolation前提 |
| TinyClaw | OS `crontab` + helper script files | cron expr (5-field) | queue file write | queue processor任せ | crontab依存 | host環境依存だが単純 |
| SafeClaw | APScheduler in-memory jobs | date/interval/cron | callback | action側実装 | APScheduler依存 | rule-based automation |
| Penny | DB schedules + background scheduler policies | cron user schedules + internal periodic policies | background agent executes | channel response from agent | idle gating + priority + foreground suspend | scheduler policy が主題 |

### 4.3 OpenClaw 再実装に効く比較ポイント
| 論点 | OpenClaw | 軽量派（nanobot/pico/mimi） | 拡張派（iron/zero/nano/tiny/penny） |
|---|---|---|---|
| Heartbeat no-op 最適化 | token strip + prune + dedupe + visibility | 文字列判定のみ | プロジェクトにより差大 |
| CronとHeartbeat連携 | wake API + system event bridge | ほぼ分離（連携薄い） | そもそも heartbeatなし/別概念あり |
| 永続化と回復 | migration/repair + replay + stale cleanup | JSON簡易 | SQLite/DB/log中心 |
| 実行モデル | main / isolated を明示分離 | callback/agent run混在 | engine/queue/container policy に進化 |

## 5. OpenClaw 深掘り（基準実装）

### 5.1 設計の核: heartbeat と cron を分け、wake/event で接続する
OpenClaw の中核アイデアは、heartbeat と cron を「別 subsystem」にしつつ、以下で橋渡しすることにある。

- heartbeat runner: `repos/_claw/openclaw/src/infra/heartbeat-runner.ts`
- wake coalescer: `repos/_claw/openclaw/src/infra/heartbeat-wake.ts`
- cron service: `repos/_claw/openclaw/src/cron/service.ts` と `repos/_claw/openclaw/src/cron/service/*`
- wiring: `repos/_claw/openclaw/src/gateway/server-cron.ts`

この構成により、cron は「精密発火・永続化・再起動耐性」に集中でき、heartbeat は「main session点検・文脈判断・通知抑制」に集中できる。

### 5.2 Heartbeat runner の実装ポイント（OpenClaw）

1. **per-agent heartbeat と設定マージ**
- `agents.defaults.heartbeat` と `agents.list[].heartbeat` をマージ。
- どれか1 agent に heartbeat block がある場合、その agent 群のみ heartbeat 実行。

2. **wake reason の正規化と優先度付き coalescing**
- `interval`, `retry`, `manual`, `wake`, `hook:*`, `cron:*`, `exec-event` を分類。
- `heartbeat-wake.ts` で wake target（agentId/sessionKey 単位）ごとに保留し、優先度の高い理由で上書き。
- busy (`requests-in-flight`) の場合は retry タイマーを保持し、バックオフが即時再スケジュールで潰れないよう保護。

3. **preflight で file gate + event bypass を一元化**
- `HEARTBEAT.md` が “effectively empty” なら interval heartbeat を skip。
- ただし `cron:*` / `exec-event` / `wake` / `hook:*` や queued cron-tagged events がある場合は file gate を bypass。
- これにより「heartbeat file が空でも cron reminder は流せる」。

4. **main lane busy のときは skip + retry**
- command queue (`CommandLane.Main`) が詰まっていれば `requests-in-flight` で skip。
- wake queue 側が retry へ回す。heartbeat runner 自体はブロックしない。

5. **no-op heartbeat の副作用抑制**
- `HEARTBEAT_OK` / 短い ack は `ackMaxChars` で内部 ack とみなして外部配送抑制。
- transcript を run 前サイズに truncate（`pruneHeartbeatTranscript`）。
- session `updatedAt` を restore し、heartbeat no-op が session keepalive 延長にならないようにする。
- 24h 同一 payload 重複抑制（nagging防止）。

6. **cron/exec system event で prompt を切り替える**
- queued system events を見て、exec completion 用 prompt / cron reminder 用 prompt を構築。
- cron reminders が default heartbeat checklist prompt で処理される誤配線を防ぐ。

7. **delivery と visibility の分離**
- `target: last|none|channel` + `to` + `accountId` + thread/topic の解決。
- channel/account 単位の visibility (`showOk`, `showAlerts`, `useIndicator`) を適用。
- heartbeat plugin の `checkReady` でチャネル準備状態を確認可能。

### 5.3 Cron service の実装ポイント（OpenClaw）

1. **型付きジョブモデル**
- `CronSchedule`: `at` / `every` / `cron`（cron は optional `staggerMs`）
- `sessionTarget`: `main` / `isolated`
- `wakeMode`: `now` / `next-heartbeat`
- `delivery`: `none` / `announce` / `webhook`
- payload は `systemEvent` / `agentTurn`

2. **オペレーション層とタイマー層の分離**
- `ops.ts`: CRUD / manual run / status / list（store lock + persist + armTimer）
- `timer.ts`: due 判定、実行、結果適用、backoff、missed/rearm/replay
- 読み取り系で maintenance recompute を使い、`nextRunAtMs` を勝手に前進させない工夫あり。

3. **信頼性ハードニングが厚い**
- stale `runningAtMs` cleanup on startup
- missed jobs replay（ただし interrupted job の再実行ループを避ける対策群）
- timer clamp（最大60s）+ `running` 中にも再armして silent-death 防止
- one-shot job の error/skip でも disable（tight loop防止）
- cron schedule 再計算失敗の error count と auto-disable
- consecutive error backoff
- `MIN_REFIRE_GAP_MS` による同秒再発火スピン防止

4. **`wakeMode=now` の main job は heartbeat を同期的に叩ける**
- `executeJobCore()`（`cron/service/timer.ts`）で main job は system event enqueue 後、`runHeartbeatOnce()` を retry付きで呼ぶ。
- busy が長引く場合は `requestHeartbeatNow()` にフォールバックしてジョブを完了扱いにできる。
- これにより「今すぐ知らせたい reminder」と「main lane が忙しい現実」の両立を取っている。

5. **isolated cron は delivery を分離して扱う**
- isolated run 実行と announce/webhook delivery を分離。
- delivery 済みなら main session summary を抑制して重複通知を避ける。

### 5.4 OpenClaw の中核アイデア（再実装観点）
- **EventInbox + WakeQueue + HeartbeatRunner + CronTimer** の4層分離
- heartbeat no-op を単に「返信しない」ではなく、**履歴・セッション寿命・通知重複**まで制御
- cron の due 判定・永続化・回復ロジックを heartbeat から切り離す
- main session への反映は system event 経由に限定して、LLM実行レーンの責務を崩さない

## 6. 派生プロジェクト分析（実装アプローチ別）

### 6.1 NanoBot（Python最小構成）
- `HeartbeatService` と `CronService` をそれぞれ単純な asyncio loop / timer で実装。
- heartbeat は file empty 判定で API call を完全に skip（missing file も skip）。
- cron は JSON store + `next_run_at_ms` の再計算 + callback 実行。
- `on_job` callback が `agent.process_direct(session_key=f"cron:{id}")` を呼ぶ構成で、execution と delivery が密結合。
- 利点: 実装量が少なく追いやすい。
- 欠点: busy調停、重複抑制、再起動回復、backoff、delivery分離が弱い。

### 6.2 PicoClaw（Goで実用拡張された軽量系）
- NanoBot系の思想を Go に移しつつ、heartbeat と cron を現実運用向けに強化。
- heartbeat:
  - `HEARTBEAT.md` missing時にテンプレを自動生成
  - no-history heartbeat (`ProcessHeartbeat(... NoHistory=true)`)
  - last external channel state を用いた通知先解決
  - `ToolResult.Async/Silent` を使って spawn ベースの非同期処理と相性を取る
- cron:
  - 1秒ポーリングで due 判定
  - 実行前に `nextRunAtMS=nil` を保存して duplicate fire を防止
  - `CronTool` で direct deliver / shell command / agent run を分岐
- OpenClawとの違い:
  - `main` vs `isolated` や `wakeMode` の明示モデルはなく、tool 層で実行・通知の意思決定をまとめている。

### 6.3 MimiClaw（ESP32組込向け）
- heartbeat と cron の両方を **message bus への inbound 注入**で統一しているのが特徴。
- heartbeat:
  - FreeRTOS timer + Cの行スキャン（低コスト）
  - actionable line がなければ何もしない
- cron:
  - static array + SPIFFS JSON (`cron.json`) + check interval polling
  - `every` / `at` のみ（cron expr は未実装）
  - due になったら message bus へ push
- 追加の実用配慮:
  - `cron_add` の Telegram 宛先を turn context から補正する patch（`agent_loop.c`）
- 学び:
  - リソース制約下では「全トリガを同じ inbound bus に流す」設計が強い。

### 6.4 ZeroClaw（Rust、DB駆動 cron + 軽量 heartbeat）
- heartbeat はかなり薄く、`HEARTBEAT.md` を bullet 行でパースして「タスク一覧」を得るだけ。
- daemon worker が各タスクを個別 `agent::run` で実行するため、OpenClaw の単一 heartbeat turn とは別物。
- cron は逆に厚く、SQLite+typed schedule/job/delivery/run history + retry/backoff + concurrency + security policy を備える。
- shell job の security policy / action budget / forbidden path check が強力。
- 学び:
  - heartbeat と cron の強度バランスを意図的に変える設計も可能。
  - ただし heartbeat を task fan-out にすると、OpenClaw的な「1ターンで横断的に優先度判断」能力は落ちる。

### 6.5 IronClaw（heartbeat + routines 一般化）
- heartbeat 自体は OpenClaw系に近い（checklist + `HEARTBEAT_OK` + notify suppression）。
- ただし heartbeat tick で memory hygiene をバックグラウンド実行するなど、運用保守タスクを同居させている。
- 真の拡張点は `routines`:
  - trigger: cron / event / webhook / manual
  - action: lightweight / full_job（現状 full_job は lightweight fallback）
  - guardrails: cooldown / max_concurrent / global cap
  - notify policy と run log がDB一体管理
- 学び:
  - OpenClaw の cron + heartbeat を将来拡張するなら、`routines` のような trigger/action/guardrail モデルが自然。

### 6.6 NanoClaw（container group scheduler）
- `HEARTBEAT.md` 型ではなく、SQLite `scheduled_tasks` を 60秒 polling する scheduler loop。
- due task は `GroupQueue` に enqueue され、groupごとの直列性と全体の concurrency cap を担保。
- 実行は container agent を起動し、streamed output をユーザーへ転送。
- `context_mode` で group session 継続 / isolated を選べる。
- 学び:
  - multi-tenant / group isolation 環境では、scheduler は LLM runner より container orchestration と結合した方が実用的。

### 6.7 TinyClaw（shell + queue + crontab）
- heartbeat は `lib/heartbeat-cron.sh` が shell loop で各 agent の `heartbeat.md` を読み、queueに `@agent` メッセージを投げる。
- queue processor (`src/queue-processor.ts`) が 1秒ポーリングで処理し、heartbeat channel の応答ファイル名を固定化して script 側が回収。
- 定期スケジュールは system `crontab` に helper script を登録するスキル (`schedule.sh`) に委譲。
- 学び:
  - app 内 scheduler を持たず、queue を唯一のトリガ注入面にする設計は運用は簡単だが、ホスト依存（crontab/tmux）になる。

### 6.8 SafeClaw（比較対象: APSchedulerラッパー）
- `AsyncIOScheduler` を薄く包み、`date` / `interval` / `cron` を提供。
- reminder action が memory と scheduler を橋渡しする典型例。
- LLM heartbeat の設計議論には直接乗らないが、標準 scheduler を使う切り分けの参考になる。

### 6.9 Penny（比較対象: idle-aware policy scheduler）
- `BackgroundScheduler` が複数 Schedule policy を優先度順に評価し、1 tick 1 task 実行。
- `AlwaysRunSchedule` / `PeriodicSchedule` / `DelayedSchedule` を分離し、idle threshold と foreground activity に反応。
- User cron schedule 実行は `ScheduleExecutor`（croniter）に委譲しつつ、全体の background 動作を同一 scheduler で制御。
- 学び:
  - 「cron parser」より上位の `SchedulePolicy` 抽象は、heartbeat + maintenance + analytics worker を同時に扱う時に有効。

## 7. 中核アイデアの抽出（再実装に使う観点）

### 7.1 Heartbeat と Cron を分離し、EventInbox で接続する
OpenClawが最も洗練されている点はここ。

- heartbeat: 文脈を持つ「点検レーン」
- cron: 精密な時間トリガと永続ジョブ管理
- 接続: system event enqueue + wake API

この分離がないと、scheduler と会話ロジックが密結合し、再起動耐性と複雑性の両方が悪化する。

### 7.2 no-op heartbeat は「通知抑制」だけでなく「履歴汚染抑制」まで設計する
OpenClaw / IronClaw / NanoBot / PicoClaw / MimiClaw すべて `HEARTBEAT_OK` 契約を持つが、OpenClaw はさらに:

- ack token strip
- transcript prune
- session updatedAt restore
- duplicate suppression

まで踏み込む。長期運用ではここが効く。

### 7.3 実行注入面を1つに寄せるほど小さく作れる
MimiClaw/TinyClaw/NanoClaw は「message bus / queue / group queue」へ集約しており、実装が単純。

- 利点: トリガ種類が増えても agent loop 側を増やさない
- 欠点: main/isolated、delivery、wakeの表現力が弱くなりやすい

### 7.4 DB化すると cron 以外（event/webhook/manual）へ拡張しやすい
IronClaw routines / NanoClaw scheduled_tasks / ZeroClaw cron_jobs は、DBモデル化により次が容易。

- run history / audit
- runtime state（next_run, failures, cooldown）
- concurrency / guardrail
- 管理UIやAPI

### 7.5 Scheduler は壊れる前提で設計する
OpenClaw と ZeroClaw はこの認識が強い。

- stale running marker cleanup
- timer re-arm under long running jobs
- missed-job replay
- error backoff
- output truncation / run history retention
- read path で next_run を勝手に進めない

これらは MVP では省きがちだが、定期実行では最初に壊れるポイント。

## 8. `repos/amem` 系の再実装を見据えた設計提案（heartbeat / periodic execution）

ここでは、`agentic_memory` 調査を踏まえて `repos/amem` を構築した流れと同様に、将来的な `agentic_heartbeat` 再実装に使える設計骨子を抽出する。

### 8.1 推奨アーキテクチャ（OpenClaw寄りの最小構成）

1. **HeartbeatRunner**
- interval設定
- `HEARTBEAT.md`/checklist 読み込み
- no-op 判定（`HEARTBEAT_OK`）
- notify suppression
- optional active hours

2. **WakeQueue**
- reason分類（interval/manual/cron/event/retry）
- coalescing（target単位）
- busy retry/backoff

3. **CronStore + CronTimer**
- typed job model (`at/every/cron`)
- next run 計算・永続化
- due execution・one-shot semantics
- run history（最低限）

4. **EventInbox (system events)**
- cron/webhook/async exec completion を main sessionへ注入する受け口
- heartbeat が event を読んで prompt 切替できるようにする

5. **DeliveryAdapter**
- `none` / `announce` / `webhook` を execution から分離
- later: per-channel policy / visibility

### 8.2 推奨データモデル（MVP→拡張）

#### MVP CronJob
- `id`
- `name`
- `enabled`
- `schedule`: `{kind: at|every|cron, ...}`
- `execution`: `{target: main_event|isolated_turn, prompt/text, model?}`
- `wake_mode`: `now|next-heartbeat`
- `delivery`: `{mode: none|announce|webhook, channel?, to?}`
- `state`: `next_run_at`, `last_run_at`, `last_status`, `last_error`, `running_at`
- `delete_after_run`

#### 拡張（OpenClaw/ZeroClaw/IronClaw相当）
- `consecutive_errors`
- `schedule_error_count`
- `stagger_ms`
- `session_key`
- `run_history`（別テーブル/別ファイル）
- `usage telemetry`

### 8.3 Heartbeat no-op の推奨仕様（OpenClawから採用したい部分）
- `HEARTBEAT_OK` は start/end token として扱う（中間出現は通常文字列）
- `ackMaxChars` を設ける（短い挨拶付き ack も抑制可能にする）
- no-op の heartbeat は transcript を残さない、または最小化する
- no-op で session keepalive を延命しない（session policy がある場合）
- duplicate suppression 窓（例: 12h/24h）を持つ

### 8.4 Cron reliability の最低ライン（OpenClaw/ZeroClaw由来）
- startup時 stale running marker cleanup
- timer re-arm（長時間ジョブ中に scheduler が沈黙しない）
- one-shot job の error/skip でも disable/delete semantics を明確化
- error backoff（retry storm防止）
- `next_run` 再計算失敗の isolation（1件壊れても全体を止めない）
- read-only操作で `next_run` を前進させない（status/list バグ防止）

### 8.5 “main vs isolated” を先に切る理由
軽量実装では callback 内で delivery/agent run を混在させがちだが、OpenClaw のように下記を分離すると長期的に壊れにくい。

- main session reminder（文脈が必要）
- isolated scheduled analysis（正確時刻・別モデル・main履歴非汚染）

`nanobot` / `picoclaw` の簡潔さは魅力だが、再実装で将来拡張を見込むなら OpenClaw/ZeroClaw の型分離を先に入れる価値がある。

### 8.6 段階的実装プラン（現実的）

#### Phase 1: MVP（NanoBot/PicoClaw相当）
- `HEARTBEAT.md` + fixed interval heartbeat
- JSON cron store + `at/every/cron`
- isolated run only（main injectionなし）
- no-op token suppressionのみ

#### Phase 2: OpenClaw Lite
- main session injection + wake queue
- `wakeMode` (`now`/`next-heartbeat`)
- run history
- one-shot reliability semantics + stale marker cleanup
- active hours

#### Phase 3: OpenClaw Hardening
- wake coalescing priority
- retry cooldown / error backoff
- transcript prune / session keepalive suppression
- delivery modes (announce/webhook) と visibility policy
- deterministic stagger

#### Phase 4: Routines Engine（IronClaw方向）
- cron/event/webhook/manual trigger 統合
- guardrails（cooldown/max concurrent/dedup window）
- notifications policy
- DB-backed run audit + UI/API

## 9. 失敗モードと設計チェックリスト

### 9.1 scheduler が止まる / 黙る
- [ ] 長時間実行中に timer tick が来た場合の re-arm があるか
- [ ] 例外でループが抜けても再開されるか（daemon supervisor / retry loop）
- [ ] `running` フラグが stale のまま残るケースを掃除するか

### 9.2 重複実行・重複通知
- [ ] due 判定後に状態更新する前に別tickが走らないか
- [ ] one-shot の error/skip 再発火ループを防げるか
- [ ] isolated runが自前delivery済みなのに main session summary を重ねないか
- [ ] heartbeat 同文面 repeated nagging を抑止するか

### 9.3 コンテキスト汚染
- [ ] heartbeat no-op を履歴に残し続けないか
- [ ] cron reminder を default heartbeat checklist prompt で誤処理しないか
- [ ] scheduled task が main session を過剰に膨らませないか（main/isolated選択）

### 9.4 配送/ルーティングミス
- [ ] last-channel 解決が stale/unauthorized target に向かないか
- [ ] multi-account / thread/topic ルーティングの正規化はあるか
- [ ] Telegram 等で invalid chat_id のデフォルト値が混入しないか

## 10. 結論
OpenClaw派生の heartbeat / 定期実行設計は、次の方向に収束している。

1. **heartbeat（点検）と cron（精密トリガ）を分離する**  
2. **main session への反映は system event + wake で接続する**  
3. **no-op heartbeat の副作用（通知・履歴・keepalive）を管理する**  
4. **scheduler の壊れ方（stalls, duplicate fire, replay loops）を先回りで潰す**  
5. **execution と delivery を分離し、将来の trigger/action 拡張に備える**

`repos/amem` 系の再実装方針としては、まず OpenClaw Lite（Phase 2）相当を目標にして、MVP の単純さを保ちつつ `WakeQueue` と `main/isolated` の型分離だけ先に入れておくのが最も堅実。

---

## 付録: 関連ドキュメント（公開版）

- `AGENTIC_HEARTBEAT.md`（本レポート）
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
