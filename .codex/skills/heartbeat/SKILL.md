---
name: heartbeat
description: 30分ごとに秘書モードで Gmail/Tasks/Calendar を巡回し、(1) メール確認、(2) メール由来のタスク追加・更新、(3) 必要な予定のカレンダー追加、(4) 未完了タスクのリマインドを実行する。ユーザーが「heartbeat」「30分チェック」「メール確認してタスク更新して」「秘書モードで巡回」と依頼したときに使う。Google Drive と Contacts は対象外。
---

# Heartbeat Assistant Runbook

## 対象と非対象

- 対象:
  - Gmail
  - Google Tasks
  - Google Calendar
- 非対象:
  - Google Drive
  - Contacts/People

## 実行順序（固定）

1. `.codex/skills/gog-gmail/SKILL.md` でメール確認
2. `.codex/skills/gog-task/SKILL.md` でタスク追加・更新
3. `.codex/skills/gog-calendar/SKILL.md` で予定追加
4. 未完了タスクをリマインド

## 前提

- 実行バイナリは `/home/yuiseki/bin/gog` を使う。
- API 操作は `--account <email>` を必ず付与する。
- keyring backend が `file` のため、非 TTY では失敗することがある。
- TTY でパスフレーズプロンプトが混ざる場合、JSON パース前に `sed -n '/^{/,$p'` を通す。
- heartbeat の作業ディレクトリは `/home/yuiseki/Workspaces/.ai-secretary/heartbeat` を使う。
- 初回実行時に以下を作成する。

```bash
mkdir -p /home/yuiseki/Workspaces/.ai-secretary/heartbeat
```

## 状態ファイル（重複防止）

`/home/yuiseki/Workspaces/.ai-secretary/heartbeat/state.json` を使う。存在しない場合は初期化する。

```json
{
  "last_run_at": "",
  "last_mail_scan_at": "",
  "processed_thread_ids": []
}
```

- `processed_thread_ids` は最新 200 件のみ保持する。
- 同一スレッドを再処理しないことを最優先にする。
- 実行ログは `/home/yuiseki/Workspaces/.ai-secretary/heartbeat/logs/` に保存する。

## Personalization Rules

- ルールディレクトリ: `/home/yuiseki/Workspaces/.ai-secretary/heartbeat/personalization-rules/`
- 各ルールは `<rule-name>/RULE.md` 形式で置く。
- heartbeat 実行時はメール分類の前にルールを読み込む。
- 競合時は「無視ルール（ignore）」を優先する。

読み込み確認例:

```bash
find /home/yuiseki/Workspaces/.ai-secretary/heartbeat/personalization-rules -name RULE.md -maxdepth 3 -type f
```

既知ルール例:

- `ignore-yamato`: ヤマト運輸の「お荷物お届けのお知らせ」を無視する。
  - 判定目安: `from` が `mail@kuronekoyamato.co.jp` かつ `subject` に `お荷物お届けのお知らせ` を含む。
  - 動作: タスク/カレンダー化しない。`processed_thread_ids` には記録して再判定を防ぐ。

## 30分ごとの実行手順

1. 現在時刻と認証状態を確認する。

```bash
/home/yuiseki/bin/gog auth status
/home/yuiseki/bin/gog time now --json
```

2. メール候補を取得する（広めに取得してローカルで絞る）。

```bash
/home/yuiseki/bin/gog --account <email> gmail search 'in:inbox newer_than:2d' --max 50 --json \
| sed -n '/^{/,$p'
```

3. 日付で降順に再ソートし、未処理スレッドだけを対象にする。

```bash
jq '.threads | sort_by(.date) | reverse'
```

4. Personalization Rules を先に適用し、除外対象を落としてから各メールを分類して反映する。
- タスク化条件:
  - 返信・提出・確認・対応などの行動が必要
  - 期限や依頼が含まれる
- カレンダー化条件:
  - 明確な日時（開始・終了、または日付）を含む予定

5. タスク反映（重複防止付き）。
- 既存検索は notes の `heartbeat-thread:<threadId>` で照合する。
- 既存未完了タスクがあれば `update`、なければ `add`。
- notes 末尾に必ず以下を残す:
  - `heartbeat-thread:<threadId>`
  - `mail-subject:<subject>`
  - `mail-date:<date>`

6. カレンダー反映（重複防止付き）。
- `calendar search` で `heartbeat-thread:<threadId>` を検索し、存在しなければ `calendar create`。
- 予定 description に `heartbeat-thread:<threadId>` を必ず入れる。
- 時刻不明で日付のみ判定できる場合は `--all-day` で作成する。

7. 未完了タスクをリマインドする。
- `tasks list` で `needsAction` を列挙し、上位 5 件を通知する。
- 期限ありを優先して並べる。
- リマインド本文には `title`、`due`、`updated` を含める。

## 実用コマンド例

タスクリスト ID（`マイタスク`）取得:

```bash
/home/yuiseki/bin/gog --account <email> tasks lists list --json \
| sed -n '/^{/,$p' \
| jq -r '.tasklists[] | select(.title=="マイタスク") | .id'
```

未完了タスク一覧:

```bash
/home/yuiseki/bin/gog --account <email> tasks list <tasklistId> --all --json \
| sed -n '/^{/,$p' \
| jq -r '.tasks // [] | map(select(.status=="needsAction"))'
```

カレンダー重複確認（thread ID をキーに照合）:

```bash
/home/yuiseki/bin/gog --account <email> calendar search 'heartbeat-thread:<threadId>' --calendar primary --max 1 --json \
| sed -n '/^{/,$p'
```

## 出力フォーマット

各回の終了時に必ず次を報告する。

- 実行時刻
- 走査メール件数
- タスク追加件数
- タスク更新件数
- 予定追加件数
- 未完了タスクの要約（最大 5 件）

## 運用ルール

- 書き込み系操作前に `--dry-run` を優先する。
- 曖昧なメールは勝手にカレンダーへ入れず、まずタスク化する。
- 同一件名でも thread ID が違う場合は別件として扱う。
- 失敗時は処理を止めず、失敗した対象とエラーを報告して次へ進む。
