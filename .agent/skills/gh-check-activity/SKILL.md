---
name: gh-check-activity
description: |
  GitHub 上の自分の最新活動（PR, Issue, Commit, Repository）を確認する。
  用途: (1) 進行中の PR/Issue のステータス確認、(2) 最新のコミット履歴の把握、(3) 最近作成したリポジトリの確認。
  このスキルは原則として Read-only で動作する。
---

# gh-check-activity Skill

自分の GitHub における最近の活動状況を確認し、サマリーを提供するためのスキルです。

## 主な用途
- 直近で作成または更新したプルリクエスト（PR）やイシュー（Issue）の状態（オープン、マージ済み、クローズ）を確認する。
- 最新のコミット履歴や新しく作成したリポジトリを把握する。

## 推奨されるコマンド

### 自分の最新の PR と Issue を取得
```bash
gh search prs --author "@me" --sort updated --limit 5 --json title,state,repository,updatedAt
gh search issues --author "@me" --sort updated --limit 5 --json title,state,repository,updatedAt
```

### 最新のリポジトリ（新規作成順）を取得
```bash
gh repo list --limit 5 --json name,createdAt,pushedAt --jq 'sort_by(.createdAt) | reverse'
```

### 自分の最近のコミットを取得
```bash
gh search commits --author "@me" --sort committer-date --limit 5 --json sha,commit,repository,url
```

### 自分の関連するステータスのサマリーを表示
自分に割り当てられた Issue, PR、レビュー依頼、メンションのサマリーを一覧で表示します。
```bash
gh status
```

## 動作フロー
1. `gh status` を実行して、自分に関連する進行中のタスク（割り当てられた Issue やレビュー依頼）のサマリーを確認する。
2. `gh repo list` で最近作成したリポジトリがあるか確認する。
3. `gh search commits` で直近の作業内容（コミットメッセージ）を確認する。
4. `gh search prs` や `gh search issues` を用いて、進行中のプロジェクトの更新状態を確認する。
5. 活動内容を整理し、ユーザーに簡潔に報告する。

## 注意事項
- Read-only の用途を想定しているため、このスキルで PR の作成や Issue のクローズなどの操作は原則行いません。
- 日時が新しい順に表示し、最近の活動を優先的に扱います。
