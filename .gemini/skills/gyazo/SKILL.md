---
name: gyazo
description: Gyazo CLI を操作して過去のキャプチャ（画像、OCRテキスト、メタデータ）を検索・取得・同期する。ユーザーの視覚的な記憶やリサーチ内容を調査する際に使用する。
---

# Gyazo CLI Skill Runbook

## 概要
`gyazo` CLI ツールを使用して、Gyazo に保存されたキャプチャ画像を操作します。OCR テキストやウィンドウタイトルなどのメタデータを含めて取得・検索が可能です。

## 前提
- 実行バイナリ: `gyazo`
- 認証: `gyazo config set token <token>` で設定済みであること（`~/.config/gyazo/credentials.json` に保存される）。
- キャッシュ: `~/.cache/gyazocli/` に画像詳細が保存される。

## 基本コマンド

### 1. 画像の一覧取得
直近の画像、または特定の日付の画像を列挙します。
```bash
gyazo ls --limit 10
gyazo search "date:2026-02-19" --json
```

### 2. 画像詳細の取得 (OCR含む)
特定の `image_id` の詳細情報を取得します。OCR 結果やキャプチャ時の URL、アプリケーション名が含まれます。
```bash
gyazo get <image_id>
gyazo get <image_id> --json
```

### 3. 全文検索
画像内のテキストやメタデータを検索します。
```bash
gyazo search "検索ワード" --json
```

### 4. ローカル同期
直近の画像をフェッチし、詳細情報（OCR等）をローカルキャッシュに蓄積します。
```bash
gyazo sync --max-pages 1
```

## AI 秘書としての活用シナリオ
- **過去の活動調査:** 「昨日の夕方に見ていたサイトは？」という問いに対し、`gyazo search "date:YYYY-MM-DD"` で画像メタデータを調査する。
- **視覚情報の抽出:** 画像内の OCR テキストを `gyazo get` で取得し、内容を要約・分析する。
- **リサーチの継続:** 以前キャプチャした商品や文献の情報を `gyazo search` で探し出す。

## 運用ルール
- 大量の画像を取得する場合は `--limit` や `sync` の `max-pages` を適切に制限し、レート制限（429）に配慮する。
- JSON 出力を受け取る際は `jq` などを組み合わせて必要な情報のみを抽出する。
