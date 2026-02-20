---
name: hatebu
description: Hatena Bookmark CLI を操作して、ユーザーのブックマーク履歴を同期・取得・検索する。ユーザーの興味関心や過去に読んだ記事を調査する際に使用する。
---

# Hatena Bookmark CLI Skill Runbook

## 概要
`hatebu` CLI ツールを使用して、はてなブックマークのデータを操作します。特定の日付のブックマーク一覧の取得や、ローカルキャッシュの同期が可能です。

## 前提
- 実行バイナリ: `hatebu`
- 認証: `hatebu config set username <name>` で設定済みであること（`~/.config/hatebu/credentials.json` に保存される）。
- キャッシュ: `~/.cache/hatebucli/` に `YYYY/MM/DD.json` 形式で保存される。

## 基本コマンド

### 1. ブックマークの一覧取得
特定の日付のブックマークをキャッシュから読み込みます。
```bash
hatebu ls --date 2026-02-19
hatebu ls --date 2026-02-19 --json
```

### 2. RSS からの同期
Hatena の RSS フィードから最新のブックマークを取得し、ローカルにキャッシュします。
```bash
hatebu sync --date 2026-02-19
hatebu sync --days 7
```

## AI 秘書としての活用シナリオ
- **興味関心の分析:** `hatebu ls` で取得したタイトルの集合から、ユーザーが現在どのようなトピック（AI, 開発, 政治など）に注目しているかを分析する。
- **ニュースサマリーの作成:** 特定の日付のブックマークを元に、新聞風のサマリー（`public/summary/...`）を作成する。
- **過去記事の再発見:** 「以前ブックマークしたあの記事」をキャッシュから検索する。

## 運用ルール
- キャッシュがない場合はまず `sync` を実行するようにユーザーに促す、または自動で `sync` を試みる。
- Hatena の RSS 取得には 0.5s 程度のディレイを挟み、サーバーへの負荷を軽減する。
