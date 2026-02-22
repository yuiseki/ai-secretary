# OpenClaw

## Quick facts
- heartbeat と cron を明確に分離し、`wake` / system event で連携する基準実装。
- heartbeat は `HEARTBEAT.md` + queued system events を main session 文脈で処理。
- cron は typed job model + timer/recovery/backoff を持つ高信頼 scheduler。

## 主要実装ファイル
- heartbeat runner: `repos/_claw/openclaw/src/infra/heartbeat-runner.ts`
- wake coalescer: `repos/_claw/openclaw/src/infra/heartbeat-wake.ts`
- heartbeat prompt/no-op token処理: `repos/_claw/openclaw/src/auto-reply/heartbeat.ts`
- heartbeat event filtering: `repos/_claw/openclaw/src/infra/heartbeat-events-filter.ts`
- cron service facade: `repos/_claw/openclaw/src/cron/service.ts`
- cron ops/timer/jobs/store: `repos/_claw/openclaw/src/cron/service/*.ts`
- gateway wiring: `repos/_claw/openclaw/src/gateway/server-cron.ts`

## Heartbeat アーキテクチャ

### 実行モデル
- per-agent 設定を持てる (`agents.defaults.heartbeat` + `agents.list[].heartbeat`)。
- `startHeartbeatRunner()` が agentごとの `nextDueMs` を管理し、最短 due 時刻に `setTimeout`。
- 実際の起動要求は `requestHeartbeatNow()` で `heartbeat-wake.ts` の wake queue に入る。

### WakeQueue（重要）
- wake target は `agentId` / `sessionKey` 単位で coalesce。
- reason 優先度を持つ（`retry` / `interval` / action系）。
- busy skip (`requests-in-flight`) は retry timer で再試行。
- handler lifecycle の世代管理で、古い runner の disposer が新しい handler を消さない。

### Preflight と skip 条件
- `HEARTBEAT.md` の実ファイル内容を読み、effectively empty なら interval heartbeat を skip。
- ただし `cron:*` / `exec-event` / `wake` / `hook:*` や cron-tagged queued events は file gate を bypass。
- active hours (`heartbeat.activeHours`) も preflight前に判定。
- main command lane が busy なら `requests-in-flight` を返し、wake layerが再試行を担当。

### no-op 抑制（OpenClawの強み）
- `HEARTBEAT_OK` token を start/end のみ特別扱い。
- `ackMaxChars` 以内の短文 ack は no-op とみなして配送抑制。
- no-op/ack時は transcript file を truncate（heartbeat turn を削除）。
- session store `updatedAt` を restore（no-op heartbeatでセッション寿命を延ばさない）。
- 直近24h 同一 payload の duplicate suppression。

### cron / exec completion 連携
- system event queue を peek して、`exec finished` や `cron:` tag を認識。
- heartbeat prompt を default checklist から event-specific prompt に差し替え。
- これにより cron reminder や exec completion が checklist prompt に埋もれない。

### Delivery / visibility
- `target: last|none|<channel>` + `to` + `accountId` + thread/topic を解決。
- channel/account別 heartbeat visibility (`showOk`, `showAlerts`, `useIndicator`) を適用。
- channel plugin の readiness check フックを呼べる。

## Cron アーキテクチャ

### ジョブモデル
- `CronSchedule`: `at` / `every` / `cron` (+ `staggerMs`)
- `sessionTarget`: `main` / `isolated`
- `wakeMode`: `now` / `next-heartbeat`
- `payload`: `systemEvent` / `agentTurn`
- `delivery`: `none` / `announce` / `webhook`

### ストアと互換性
- JSON store を load/save しつつ migration/repair を実施。
- legacy payload / legacy delivery hints の吸収ロジックが厚い。
- `enabled` 欠損や旧フィールドも補正しやすい設計。

### scheduler 信頼性（特に強い部分）
- startup 時 `runningAtMs` stale marker cleanup
- missed job replay（再起動後の catch-up）
- timer clamp（最大60s）で時刻ジャンプ/停止から復帰しやすい
- timer fire中に job実行中でも re-arm して silent death を防ぐ
- one-shot job の error/skip でも disable（再発火ループ防止）
- consecutive error backoff
- cron next_run 同秒再計算に対する `MIN_REFIRE_GAP_MS`
- schedule compute error count + auto-disable

### main vs isolated の分離
- `main` job: system event enqueue → `wakeMode` に応じて heartbeat を叩く
- `isolated` job: cron専用セッションで agent run → announce/webhook delivery
- delivery 済みかどうかで main session summary relay を抑制

### `wakeMode=now` の実装が重要
- `main` cron job は `runHeartbeatOnce()` を retry付きで同期的に呼べる。
- main lane busy が続く場合は `requestHeartbeatNow()` にフォールバック。
- 「今すぐ通知したい」要件と「main lane 混雑」の両立ができる。

## Notable ideas
- Heartbeat no-op の副作用（履歴・updatedAt・重複通知）まで管理している。
- Cron と heartbeat の連携を system event + wake API に限定して責務を壊していない。
- read系操作で `nextRunAtMs` を勝手に進めない配慮があり、status/list 系バグを避ける。

## 留意点
- 機能が多く、再実装時は full clone より段階導入（MVP→Hardening）が現実的。
- heartbeat / cron / delivery / channels が広く結合するため、回帰テストの重要度が高い。
