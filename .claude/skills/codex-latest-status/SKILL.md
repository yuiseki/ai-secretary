---
name: codex-latest-status
description: |
  Codex エージェントの最新セッション状態を確認する。
  用途: (1) Codex が現在タスク実行中か完了済みか待機中かを把握する、(2) 最後に何をしていたかを確認する、(3) 複数エージェント並行作業時の状況掌握。
  このスキルは Read-only で動作する。
---

# codex-latest-status Skill

`~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` の最新ファイルを解析して、Codex エージェントの現在の状態を報告するスキルです。

## 判断できること

- **実行中 / 完了済み**: 最後のイベントが `task_started` より `task_complete` が新しければ完了
- **今何をしているか**: 最新の `agent_message`（phase=commentary）の内容
- **最後に完了したタスク**: 最後の `task_complete` の `last_agent_message`
- **セッション情報**: 開始時刻、使用モデル、作業リポジトリ・ブランチ

## 実行スクリプト

以下の Python スクリプトを実行して状態を取得する：

```python
import json, glob, os, datetime

# 最新セッションファイルを取得
files = sorted(glob.glob(os.path.expanduser('~/.codex/sessions/2026/**/*.jsonl'), recursive=True))
if not files:
    print('セッションファイルが見つかりません')
    exit()

latest = files[-1]
print(f'セッションファイル: {latest}')

with open(latest) as f:
    lines = f.readlines()

# session_meta から基本情報を取得
meta = json.loads(lines[0]).get('payload', {})
print(f'開始時刻: {meta.get("timestamp", "?")}')
print(f'モデル: {meta.get("model_provider", "?")}')
git = meta.get('git', {})
print(f'リポジトリ: {git.get("repository_url", "?")} / {git.get("branch", "?")}')
print()

# 最後の task_started / task_complete を比較してステータス判定
last_tc = last_ts = None
last_tc_payload = last_ts_payload = None
last_agent_msg = None
last_user_msg = None

for line in reversed(lines):
    d = json.loads(line)
    if d.get('type') == 'event_msg':
        pt = d.get('payload', {}).get('type', '')
        if pt == 'task_complete' and last_tc is None:
            last_tc = d['timestamp']
            last_tc_payload = d['payload']
        if pt == 'task_started' and last_ts is None:
            last_ts = d['timestamp']
            last_ts_payload = d['payload']
        if pt == 'agent_message' and last_agent_msg is None:
            last_agent_msg = d['payload']
        if pt == 'user_message' and last_user_msg is None:
            last_user_msg = d['payload']

# ステータス判定
last_event = json.loads(lines[-1])
last_event_ts = last_event.get('timestamp', '')
now_utc = datetime.datetime.now(datetime.timezone.utc)
last_event_dt = datetime.datetime.fromisoformat(last_event_ts.replace('Z', '+00:00'))
idle_minutes = (now_utc - last_event_dt).total_seconds() / 60

if last_ts and last_tc and last_ts > last_tc:
    status = '🔄 タスク実行中'
elif idle_minutes > 30:
    status = '💤 待機中（長時間アイドル）'
elif last_tc:
    status = '✅ 最後のタスク完了済み'
else:
    status = '❓ 不明'

print(f'ステータス: {status}')
print(f'最終イベント: {last_event_ts} ({idle_minutes:.1f}分前)')
print()

# 最後の agent_message（commentary）
if last_agent_msg:
    msg = last_agent_msg.get('message', '')
    phase = last_agent_msg.get('phase', '')
    print(f'最後のエージェントメッセージ ({phase}):')
    print(f'  {msg[:300]}')
    print()

# 最後の task_complete の内容
if last_tc_payload:
    final_msg = last_tc_payload.get('last_agent_message', '')
    print(f'最後のタスク完了メッセージ:')
    print(f'  {final_msg[:400]}')
    print()

# 最後の user_message
if last_user_msg:
    umsg = last_user_msg.get('message', '')
    print(f'最後のユーザーメッセージ:')
    print(f'  {umsg[:200]}')
```

## 動作フロー

1. `~/.codex/sessions/` 以下の最新 `.jsonl` ファイルを特定する
2. スクリプトを実行してセッション状態を解析・表示する
3. ステータス（実行中 / 完了済み / 長時間アイドル）を判定してユーザーに報告する

## ステータス判定ロジック

| 状態 | 判定条件 |
|------|---------|
| タスク実行中 | `task_started` のタイムスタンプ > `task_complete` のタイムスタンプ |
| タスク完了済み | `task_complete` が最後かつアイドル30分未満 |
| 長時間アイドル | 最終イベントから30分以上経過 |

## 注意事項

- Codex セッションファイルは `~/.codex/sessions/` に保存される（`/home/yuiseki/Workspaces/.codex/` とは別）
- `reasoning` ペイロードの内容は暗号化されているため読み取り不可
- オーナーへの返答待ちを明示するフラグはないため、`task_complete` 後の経過時間で推測する
