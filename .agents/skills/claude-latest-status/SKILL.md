---
name: claude-latest-status
description: |
  Claude Code エージェントの最新セッション状態を確認する。
  用途: (1) Claude が現在ツール実行中か入力待ちかセッション終了済みかを把握する、(2) 最後に何をしていたかを確認する、(3) 複数エージェント並行作業時の状況掌握。
  このスキルは Read-only で動作する。
---

# claude-latest-status Skill

`~/.claude/projects/<project>/UUID.jsonl` の最新ファイルと、実行中の Claude プロセスの有無を組み合わせて、Claude Code エージェントの現在の状態を正確に報告するスキルです。

## セッションログの場所（Linux）

macOS の `~/.claude/sesslogs/` に相当するログは、Linux では以下に保存される：

```
~/.claude/projects/<cwd-path-をハイフン区切り>/UUID.jsonl
```

例: `/home/yuiseki/Workspaces` で起動した場合
→ `~/.claude/projects/-home-yuiseki-Workspaces/UUID.jsonl`

## 判断できること

- **ツール実行中**: 最後の `assistant` イベントのコンテンツが `tool_use`
- **応答生成中**: 最後のイベントが `user`（tool_result または人間テキスト）
- **入力待ち**: 最後の `assistant` イベントのコンテンツが `text` かつ プロセスあり
- **セッション終了済み**: プロセスが存在しない
- **最後のユーザー発話・エージェント応答**: 各イベントのテキスト内容

## 実行スクリプト

以下の Python スクリプトを実行して状態を取得する：

```python
import json, glob, os, datetime, subprocess

def claude_process_running():
    result = subprocess.run(['pgrep', '-f', 'claude.*resume'], capture_output=True, text=True)
    return result.returncode == 0

# 全プロジェクトの最新 jsonl を取得
files = glob.glob(os.path.expanduser('~/.claude/projects/**/*.jsonl'), recursive=False)
# サブディレクトリ（subagents等）を除外してトップレベルのみ
files = [f for f in files if f.count('/') == os.path.expanduser('~/.claude/projects/x').count('/') + 1]
if not files:
    print('セッションファイルが見つかりません')
    exit()

latest = max(files, key=os.path.getmtime)
mtime = datetime.datetime.fromtimestamp(os.path.getmtime(latest))
print(f'セッションファイル: {latest}')
print(f'最終更新: {mtime.strftime("%Y-%m-%d %H:%M:%S")}')

with open(latest) as f:
    lines = f.readlines()

# セッション基本情報（最初の user イベントから取得）
session_id = None
cwd = None
model = None
git_branch = None
for line in lines:
    d = json.loads(line)
    if d.get('type') == 'user':
        session_id = d.get('sessionId', '')
        cwd = d.get('cwd', '')
        git_branch = d.get('gitBranch', '')
        break
    if d.get('type') == 'assistant':
        model = d.get('message', {}).get('model', '')
        break

for line in lines:
    d = json.loads(line)
    if d.get('type') == 'assistant':
        model = d.get('message', {}).get('model', '')
        break

print(f'セッションID: {session_id}')
print(f'作業ディレクトリ: {cwd}')
print(f'ブランチ: {git_branch}')
print(f'モデル: {model}')
print()

# 最後の assistant / user イベントを収集
last_assistant = None
last_user_human = None  # tool_result でないもの

for line in reversed(lines):
    d = json.loads(line)
    t = d.get('type', '')
    if t == 'assistant' and last_assistant is None:
        last_assistant = d
    if t == 'user' and last_user_human is None:
        msg_content = d.get('message', {}).get('content', '')
        if isinstance(msg_content, str):
            last_user_human = d
        elif isinstance(msg_content, list):
            if any(c.get('type') == 'text' for c in msg_content if isinstance(c, dict)):
                last_user_human = d
    if last_assistant and last_user_human:
        break

# 最後のassistantのコンテンツタイプを確認
last_assistant_content_types = []
last_assistant_text = ''
last_assistant_tool = ''
if last_assistant:
    content = last_assistant.get('message', {}).get('content', [])
    if isinstance(content, list):
        last_assistant_content_types = [c.get('type') for c in content if isinstance(c, dict)]
        for c in content:
            if isinstance(c, dict):
                if c.get('type') == 'text' and not last_assistant_text:
                    last_assistant_text = c.get('text', '')
                if c.get('type') == 'tool_use' and not last_assistant_tool:
                    last_assistant_tool = c.get('name', '')

last_assistant_ts = last_assistant.get('timestamp', '') if last_assistant else ''
last_user_ts = last_user_human.get('timestamp', '') if last_user_human else ''

# プロセス確認
process_alive = claude_process_running()

# 経過時間
now_utc = datetime.datetime.now(datetime.timezone.utc)
last_event = json.loads(lines[-1])
last_event_ts = last_event.get('timestamp', '')
if last_event_ts:
    last_dt = datetime.datetime.fromisoformat(last_event_ts.replace('Z', '+00:00'))
    idle_minutes = (now_utc - last_dt).total_seconds() / 60
else:
    idle_minutes = 0

# ステータス判定
if not process_alive:
    status = '🔚 セッション終了済み'
elif last_assistant_ts and last_user_ts and last_user_ts > last_assistant_ts:
    status = '🔄 応答生成中'
elif 'tool_use' in last_assistant_content_types:
    status = f'🔧 ツール実行中 ({last_assistant_tool})'
elif 'text' in last_assistant_content_types:
    status = '⌨️  入力待ち（プロセス稼働中）'
else:
    status = '❓ 不明'

print(f'ステータス: {status}')
print(f'プロセス稼働中: {process_alive}')
print(f'最終イベント: {last_event_ts} ({idle_minutes:.1f}分前)')
print()

# 最後のエージェント応答テキスト
if last_assistant_text:
    print(f'最後のエージェント応答:')
    print(f'  {last_assistant_text[:400]}')
    print()
elif last_assistant_tool:
    print(f'最後のツール呼び出し: {last_assistant_tool}')
    print()

# 最後のユーザー発話
if last_user_human:
    msg_content = last_user_human.get('message', {}).get('content', '')
    if isinstance(msg_content, list):
        for c in msg_content:
            if isinstance(c, dict) and c.get('type') == 'text':
                msg_content = c.get('text', '')
                break
    print(f'最後のユーザー発話:')
    print(f'  {str(msg_content)[:200]}')
```

## 動作フロー

1. `pgrep -f 'claude.*resume'` で Claude プロセスの存在を確認する
2. `~/.claude/projects/` 以下で最も更新時刻が新しい `.jsonl` を特定する
3. スクリプトを実行してセッション状態を解析・表示する
4. プロセス有無とイベント内容を組み合わせてステータスを判定し報告する

## ステータス判定ロジック

| 状態 | 判定条件 |
|------|---------|
| 🔧 ツール実行中 | 最後の `assistant` のコンテンツに `tool_use` があり プロセスあり |
| 🔄 応答生成中 | `user` のタイムスタンプ > `assistant` のタイムスタンプ かつ プロセスあり |
| ⌨️  入力待ち | 最後の `assistant` のコンテンツが `text` かつ プロセスあり |
| 🔚 セッション終了済み | プロセスが存在しない |

## 注意事項

- セッションログは `~/.claude/projects/` に保存される（macOS の `sesslogs/` とは異なる）
- プロジェクトパスはカレントディレクトリをハイフン区切りに変換したディレクトリ名になる
- `pgrep -f 'claude.*resume'` でプロセスを検出するため、`--resume` なし起動は別途 `pgrep -f 'claude'` で補完が必要な場合がある
