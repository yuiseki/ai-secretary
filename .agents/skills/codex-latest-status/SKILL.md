---
name: codex-latest-status
description: |
  Codex エージェントの最新セッション状態を確認する。
  用途: (1) Codex が現在タスク実行中か入力待ちかセッション終了済みかを把握する、(2) 最後に何をしていたかを確認する、(3) 複数エージェント並行作業時の状況掌握。
  このスキルは Read-only で動作する。
---

# codex-latest-status Skill

`~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` の最新ファイルと、実行中の Codex プロセスの有無を組み合わせて、Codex エージェントの現在の状態を正確に報告するスキルです。

## 判断できること

- **タスク実行中**: `task_started` が `task_complete` より新しく、かつ Codex プロセスが存在する
- **入力待ち**: `task_complete` が最後で、かつ Codex プロセスが存在する
- **セッション終了済み**: `task_complete` が最後で、かつ Codex プロセスが存在しない
- **今何をしているか**: 最新の `agent_message` の内容
- **最後に完了したタスク**: 最後の `task_complete` の `last_agent_message`
- **セッション情報**: 開始時刻、使用モデル、作業リポジトリ・ブランチ

## 実行スクリプト

以下の Python スクリプトを実行して状態を取得する：

```python
import json, glob, os, datetime, subprocess

# Codex プロセスが存在するか確認
def codex_process_running():
    result = subprocess.run(['pgrep', '-f', 'codex resume'], capture_output=True, text=True)
    return result.returncode == 0

# 最新セッションファイルを取得
files = sorted(glob.glob(os.path.expanduser('~/.codex/sessions/**/*.jsonl'), recursive=True))
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

# 最後の各イベントを収集
last_tc = last_ts = None
last_tc_payload = None
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
        if pt == 'agent_message' and last_agent_msg is None:
            last_agent_msg = d['payload']
        if pt == 'user_message' and last_user_msg is None:
            last_user_msg = d['payload']

# 最終イベントの経過時間
last_event = json.loads(lines[-1])
last_event_ts = last_event.get('timestamp', '')
now_utc = datetime.datetime.now(datetime.timezone.utc)
last_event_dt = datetime.datetime.fromisoformat(last_event_ts.replace('Z', '+00:00'))
idle_minutes = (now_utc - last_event_dt).total_seconds() / 60

# プロセス存在確認
process_alive = codex_process_running()

# ステータス判定（プロセス有無を組み合わせる）
if last_ts and last_tc and last_ts > last_tc and process_alive:
    status = '🔄 タスク実行中'
elif last_tc and process_alive:
    status = '⌨️  入力待ち（プロセス稼働中）'
elif last_tc and not process_alive:
    status = '🔚 セッション終了済み'
else:
    status = '❓ 不明'

print(f'ステータス: {status}')
print(f'プロセス稼働中: {process_alive}')
print(f'最終イベント: {last_event_ts} ({idle_minutes:.1f}分前)')
print()

# 最後の agent_message
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

1. `pgrep -f 'codex resume'` で Codex プロセスの存在を確認する
2. `~/.codex/sessions/` 以下の最新 `.jsonl` ファイルを特定する
3. スクリプトを実行してセッション状態を解析・表示する
4. プロセス有無とイベント履歴を組み合わせてステータスを判定し報告する

## ステータス判定ロジック

| 状態 | 判定条件 |
|------|---------|
| 🔄 タスク実行中 | `task_started` > `task_complete`（時刻比較）かつ プロセスあり |
| ⌨️  入力待ち | `task_complete` が最後 かつ プロセスあり |
| 🔚 セッション終了済み | `task_complete` が最後 かつ プロセスなし |
| ❓ 不明 | その他 |

## 注意事項

- Codex セッションファイルは `~/.codex/sessions/` に保存される（`/home/yuiseki/Workspaces/.codex/` とは別）
- `reasoning` ペイロードの内容は暗号化されているため読み取り不可
- `pgrep -f 'codex resume'` で判定するため、`codex exec`（非対話型）での起動時は検出されない場合がある
