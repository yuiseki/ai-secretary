---
name: hatebu
description: Hatena Bookmark CLI を操作して、ユーザーのブックマーク履歴を同期・取得・検索する。ユーザーの興味関心や過去に読んだ記事を調査する際に使用する。
---

# Hatena Bookmark CLI Skill Runbook

## 概要
`hatebu` CLI ツールを使用して、はてなブックマークのデータを操作します。特定の日付のブックマーク一覧の取得、ローカルキャッシュの同期、過去データのインポートが可能です。

## 前提
- 実行バイナリ: `hatebu`
- 認証設定: `hatebu config set username <name>`（`~/.config/hatebu/credentials.json` に保存）。
- キャッシュ: `~/.cache/hatebucli/` に `YYYY/MM/DD.json` 形式で保存される。

## 基本コマンド

### 1. ブックマークの一覧取得
特定の日付のブックマークを取得します。
```bash
hatebu ls --date 2026-02-19
hatebu ls --json
```
- **今日のブックマーク:** 自動的に API から最新の状態を取得します（キャッシュは使用しません）。
- **過去のブックマーク:** ローカルキャッシュから高速に読み込みます。

### 2. 同期とインポート
```bash
hatebu sync --days 7           # 昨日から遡って指定日数分のデータを RSS から同期
hatebu import <path>           # 既存のデータディレクトリ（hatebu-ai 等）から一括インポート
```

## AI 秘書としての活用シナリオ
- **長期的な興味分析:** インポートされた膨大な過去データから、数年前と現在の興味関心の変化を分析する。
- **今日のサマリー:** `hatebu ls` で今日のブックマークをリアルタイムに取得し、その日のニュースまとめを作成する。

## 運用ルール
- 今日のデータは `sync` せず、常に `ls` で最新を取得する。
- 設定が未完了の場合は `hatebu config set username` を案内する。
