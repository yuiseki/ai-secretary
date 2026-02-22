# SafeClaw

## Quick facts
- LLM heartbeat/checklist ではなく、rule-based automation engine の scheduler 実装。
- `APScheduler` を薄く包んで `date`/`interval`/`cron` を提供。
- reminder action などが scheduler を利用して timed callback を実行。

## 主要実装ファイル
- scheduler wrapper: `repos/_claw/safeclaw/src/safeclaw/core/scheduler.py`
- engine wiring: `repos/_claw/safeclaw/src/safeclaw/core/engine.py`
- reminder action: `repos/_claw/safeclaw/src/safeclaw/actions/reminder.py`

## Scheduler 実装
- `AsyncIOScheduler` を内部に保持。
- trigger type:
  - `date` (`DateTrigger`)
  - `interval` (`IntervalTrigger`)
  - `cron` (`CronTrigger`)
- `add_job()` で trigger_type を切り替え、name単位で job 管理。
- `pause` / `resume` / `remove` / `list` / `get` を実装。

## Reminder action での使われ方
- 自然言語時刻を `dateparser` で解析。
- reminder を memory に保存。
- one-shot callback を `engine.scheduler.add_one_time()` で登録。
- callback は channel送信後、memory の reminder を完了状態へ更新。

## 比較上の位置づけ
- OpenClaw 系の heartbeat/no-op/LLM文脈制御とは異なる。
- ただし「標準 scheduler を使って action 側で callback を作る」設計は、rule-based 部分の分離例として参考になる。

## 留意点
- heartbeat checklist / main session injection / isolated run といった agentic scheduling の論点は対象外。
