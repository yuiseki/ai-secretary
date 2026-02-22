# TinyClaw

## Quick facts
- shell script + queue processor + tmux/crontab を組み合わせた運用寄り実装。
- heartbeat は `lib/heartbeat-cron.sh` の外部ループ、agent runtime 内蔵ではない。
- scheduled tasks は OS `crontab` を helper script で管理して queue に流し込む。

## 主要実装ファイル
- heartbeat loop: `repos/_claw/tinyclaw/lib/heartbeat-cron.sh`
- queue processor: `repos/_claw/tinyclaw/src/queue-processor.ts`
- crontab scheduler helper: `repos/_claw/tinyclaw/.agents/skills/schedule/scripts/schedule.sh`

## Heartbeat 実装
- `heartbeat-cron.sh` が `while true; sleep INTERVAL` で heartbeat を回す。
- interval は `settings.json` (`monitoring.heartbeat_interval`) から読み込む（既定 3600s）。
- 全 agent を列挙し、agentごとの `heartbeat.md` を読み込んで queue message を作成。
- queue message は `channel: "heartbeat"` と `@agent_id` routing prefix を持つ JSON を `queue/incoming/` に配置。
- heartbeat script は後続で `queue/outgoing/` を見て heartbeat response をログし、応答ファイルを掃除。

## Queue Processor との関係
- `src/queue-processor.ts` が incoming queue を 1秒ごとに polling (`setInterval(processQueue, 1000)`)。
- heartbeat channel の応答ファイルは deterministic name (`messageId.json`) で出力。
- つまり heartbeat は「queue trigger の1種」として扱われる。

## Scheduled Tasks（OS cron bridge）
- `schedule.sh` が `crontab` エントリを生成・一覧・削除。
- 各 cron entry は helper script を実行し、queue に JSON message を書く。
- entry comment `# tinyclaw-schedule:<label>` で idempotent 管理。
- schedule 実体は app ではなく OS cron にある。

## 設計上の特徴
- queue を universal ingress として統一しており、runtime側は scheduler を知らなくてよい。
- host shell / crontab / tmux の存在を前提にした実運用設計。

## Notable ideas
- app内 scheduler を持たない代わりに、queue と helper scripts で強い単純性を確保。
- 複数 agent heartbeat を queue routing prefix で自然に処理できる。

## 留意点
- OS依存（crontab非対応環境、tmux運用、プロセス監視）が強い。
- scheduler reliability は host 環境に委譲されるため、アプリ側での再起動回復/監査は薄い。
