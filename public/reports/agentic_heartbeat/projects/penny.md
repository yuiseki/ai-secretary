# Penny（比較対象）

## Quick facts
- cron だけでなく複数 background agent を統一 scheduler で管理する設計。
- idle threshold / foreground activity を考慮した policy-based scheduler が特徴。
- user-defined cron schedules の実行は `ScheduleExecutor` が担当。

## 主要実装ファイル
- scheduler core: `repos/_claw/penny/penny/penny/scheduler/base.py`
- schedule policies: `repos/_claw/penny/penny/penny/scheduler/schedules.py`
- user cron executor: `repos/_claw/penny/penny/penny/scheduler/schedule_runner.py`

## Scheduler アーキテクチャ

### `BackgroundScheduler`
- priority order で `Schedule` policy を評価し、1 tick につき最初に発火した task を1件実行。
- global idle threshold を持ち、foreground work 中は background tasks を停止できる。
- incoming message 時に `notify_message()` で全 schedule state を reset。

### Schedule policy の分離
- `AlwaysRunSchedule`: idle 状態に関係なく interval 実行
- `PeriodicSchedule`: idle 中のみ interval 実行
- `DelayedSchedule`: idle になってからランダム delay 経過後に実行

この「policy を差し替えるだけで挙動を変える」設計は、heartbeat/maintenance/analytics を共存させる際に有用。

## User cron schedules (`ScheduleExecutor`)
- DBの user-defined schedules を巡回し、`croniter` で due 判定。
- user timezone を `ZoneInfo` で考慮。
- scheduler tick interval（既定60s）内に due になった schedule を発火。
- 実行は message agent に prompt を流し、応答を channel へ送る。

## 再実装での参考点
- `cron parser` と `background task policy` を分離する設計。
- foreground activity に応じて background 実行を suspend/resume する API。
- idle-aware task と always-run task を同一ループで扱える。

## 留意点
- OpenClaw 系の heartbeat/cross-channel delivery/session routing とは問題設定が異なる。
- cron persistence や run history よりも scheduler policy 側の抽象化が主題。
