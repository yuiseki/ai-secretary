---
name: gemini-latest-status
description: |
  Gemini エージェントの最新セッション状態を確認する。
  用途: (1) Gemini が現在タスク実行中か入力待ちかセッション終了済みかを把握する、(2) 最後に何をしていたかを確認する、(3) 複数エージェント並行作業時の状況掌握。
  このスキルは Read-only で動作する。
---

# gemini-latest-status Skill

`~/.gemini/antigravity/brain/<UUID>/task.md` の最新ファイルと、実行中の Gemini プロセスの有無を組み合わせて、Gemini エージェントの現在の状態を正確に報告するスキルです。

## セッションログの場所

```
~/.gemini/antigravity/brain/<UUID>/task.md
~/.gemini/antigravity/brain/<UUID>/task.md.metadata.json
~/.gemini/antigravity/annotations/<UUID>.pbtxt
```

## 判断できること

- **タスク実行中**: task.md に `[/]`（進行中）のタスクがあり、かつ Gemini プロセスが存在する
- **入力待ち**: task.md に `[/]` がなく、かつ Gemini プロセスが存在する
- **セッション終了済み**: Gemini プロセスが存在しない
- **最後のタスク内容**: task.md の全チェックリスト
- **セッション情報**: タスクサマリー、更新時刻

## 実行スクリプト

以下の Python スクリプトを実行して状態を取得する：

```python
import json, glob, os, datetime, subprocess, re

def gemini_process_running():
    result = subprocess.run(['pgrep', '-f', 'gemini'], capture_output=True, text=True)
    # 自分自身（pgrep/grep プロセス）を除外
    pids = [p for p in result.stdout.strip().split('\n') if p]
    if not pids:
        return False
    # 実際の gemini プロセスか確認（自分自身の PID を除外）
    my_pid = str(os.getpid())
    for pid in pids:
        if pid == my_pid:
            continue
        try:
            with open(f'/proc/{pid}/cmdline') as f:
                cmdline = f.read().replace('\0', ' ')
            # Claude 自身や grep などを除外
            if 'gemini' in cmdline and 'pgrep' not in cmdline and 'grep' not in cmdline and 'claude' not in cmdline:
                return True
        except (FileNotFoundError, PermissionError):
            pass
    return False

# 最新の task.md を取得
task_files = glob.glob(os.path.expanduser('~/.gemini/antigravity/brain/*/task.md'))
if not task_files:
    print('セッションファイルが見つかりません')
    exit()

latest_task = max(task_files, key=os.path.getmtime)
mtime = datetime.datetime.fromtimestamp(os.path.getmtime(latest_task))
uuid = os.path.basename(os.path.dirname(latest_task))
print(f'セッションファイル: {latest_task}')
print(f'最終更新: {mtime.strftime("%Y-%m-%d %H:%M:%S")}')
print(f'UUID: {uuid}')

# メタデータ読み込み
meta_path = latest_task + '.metadata.json'
summary = ''
updated_at = ''
if os.path.exists(meta_path):
    with open(meta_path) as f:
        meta = json.load(f)
    summary = meta.get('summary', '')
    updated_at = meta.get('updatedAt', '')

print(f'サマリー: {summary}')
print(f'更新日時: {updated_at}')
print()

# task.md の内容を読み込んでタスク状態を解析
with open(latest_task) as f:
    task_content = f.read()

lines = task_content.strip().split('\n')
tasks_done = []
tasks_in_progress = []
tasks_pending = []

for line in lines:
    if re.match(r'\s*-\s*\[x\]', line, re.IGNORECASE):
        tasks_done.append(line.strip())
    elif re.match(r'\s*-\s*\[/\]', line, re.IGNORECASE):
        tasks_in_progress.append(line.strip())
    elif re.match(r'\s*-\s*\[ \]', line, re.IGNORECASE):
        tasks_pending.append(line.strip())

# 経過時間
now_local = datetime.datetime.now()
idle_minutes = (now_local - mtime).total_seconds() / 60

# プロセス確認
process_alive = gemini_process_running()

# ステータス判定
if not process_alive:
    status = '🔚 セッション終了済み'
elif tasks_in_progress:
    status = '🔄 タスク実行中'
else:
    status = '⌨️  入力待ち（プロセス稼働中）'

print(f'ステータス: {status}')
print(f'プロセス稼働中: {process_alive}')
print(f'最終更新: {mtime.strftime("%Y-%m-%d %H:%M:%S")} ({idle_minutes:.1f}分前)')
print()

# タスク状態の表示
if tasks_in_progress:
    print(f'実行中のタスク:')
    for t in tasks_in_progress:
        print(f'  {t}')
    print()

if tasks_pending:
    print(f'未着手のタスク:')
    for t in tasks_pending:
        print(f'  {t}')
    print()

if tasks_done:
    print(f'完了済みタスク ({len(tasks_done)}件):')
    for t in tasks_done:
        print(f'  {t}')
    print()

# 全タスク表示
print('タスク全体:')
print(task_content[:600])
```

## 動作フロー

1. `pgrep -f 'gemini'` で Gemini プロセスの存在を確認する（grep/pgrep 自身を除外）
2. `~/.gemini/antigravity/brain/` 以下で最も更新時刻が新しい `task.md` を特定する
3. スクリプトを実行してセッション状態を解析・表示する
4. プロセス有無とタスク状態を組み合わせてステータスを判定し報告する

## ステータス判定ロジック

| 状態 | 判定条件 |
|------|---------|
| 🔄 タスク実行中 | task.md に `[/]` タスクがある かつ プロセスあり |
| ⌨️  入力待ち | task.md に `[/]` タスクがない かつ プロセスあり |
| 🔚 セッション終了済み | プロセスが存在しない |

## タスクマーカーの意味

| マーカー | 意味 |
|---------|------|
| `[x]` | 完了済み |
| `[/]` | 実行中（進行中） |
| `[ ]` | 未着手 |

## 注意事項

- セッションファイルは `~/.gemini/antigravity/brain/` に保存される
- Gemini CLI は Node.js 製のため、プロセスが `node` として見える場合がある
- `pgrep -f 'gemini'` では自分自身のプロセス（Claude 実行環境）を除外する必要がある
- annotations の `pbtxt` には `last_user_view_time` のみ含まれ、セッション内容は brain ディレクトリに格納される
