---
name: gyazo
description: Gyazo CLI を操作して過去のキャプチャ（画像、OCRテキスト、メタデータ）を検索・取得・同期する。ユーザーの視覚的な記憶やリサーチ内容を調査する際に使用する。
---

# Gyazo CLI Skill Runbook

## 概要
`gyazo` CLI ツールを使用して、Gyazo に保存されたキャプチャ画像を操作します。OCR テキストやウィンドウタイトルなどのメタデータを含めて取得・検索・時間軸での列挙が可能です。

## 前提
- 実行バイナリ: `gyazo`
- 認証設定: `gyazo config set token <token>`（`~/.config/gyazo/credentials.json` に保存）。
- キャッシュ: `~/.cache/gyazocli/` に画像詳細と時間軸インデックスが保存される。

## 基本コマンド

### 1. 画像の列挙
直近の画像、または特定の「時間帯」を指定して画像を列挙します。
```bash
gyazo ls --limit 10
gyazo ls --hour 2026-01-01-10  # 2026年1月1日 10時台の画像をキャッシュから取得
```

### 2. 検索 (API経由)
Gyazo API の検索機能を使用します。
```bash
gyazo search "date:2026-02-19" --json
gyazo search "検索ワード" --json
```

### 3. 画像詳細の取得 (OCR含む)
特定の `image_id` の詳細情報を取得・表示します。
```bash
gyazo get <image_id>
```

### 4. 同期とインポート
```bash
gyazo sync --days 7            # 昨日から遡って指定日数分のデータを同期・インデックス化
gyazo import json <path>       # 既存の JSON キャッシュを一括インポート
gyazo import hourly <path>     # 既存の hourly インデックスを一括インポート
```

## AI 秘書としての活用シナリオ
- **時間軸での記憶探索:** 「元日の午前中に何してた？」に対し、`gyazo ls --hour 2026-01-01-09` 等を実行して視覚情報を得る。
- **特定情報の深掘り:** 画像の OCR テキストから技術的なキーワードや商品名を抽出し、リサーチに役立てる。

## 運用ルール
- 今日の画像は `sync` の対象外。最新の画像が必要な場合は `ls` や `search` を使用する。
- 設定が未完了の場合は `gyazo config set token` を案内する。
