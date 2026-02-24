---
name: amem
description: |
  `amem` コマンドを使って AI 秘書向けローカルメモリー（.amem）を初期化・追記・検索・一覧・日次確認する。ユーザーが「amemで記録して」「記憶を検索して」「今日のコンテキストを見たい」など依頼したときに使う。
---

# amem CLI Skill

`amem` を実行して、`.amem` ベースのメモリー運用を行う。

## 実行場所

- 基本実行: ユーザーが対象にしているプロジェクトディレクトリで実行する。
- 開発フォールバック: `/home/yuiseki/Workspaces/repos/amem` で `cargo run -q -- ...` を使う。

## 事前確認

1. `amem --help` でコマンドが存在するか確認する。
2. 見つからない場合はフォールバックとして以下を使う:

```bash
cd /home/yuiseki/Workspaces/repos/amem
cargo run -q -- --help
```

## 主要コマンド

### 1. 初期化

```bash
amem init
```

- `.amem` のスキャフォールドを作成する。
- 既存ファイルは上書きしない（idempotent）。

### 2. メモリーディレクトリ確認

```bash
amem which
amem which --json
```

### 3. 追記（高速）

```bash
source ~/.config/yuiclaw/.env; amem keep "東京で散歩した"
source ~/.config/yuiclaw/.env; amem keep "ミーティングメモ" --kind inbox
source ~/.config/yuiclaw/.env; amem keep "振り返り" --date 2026-02-21 --source assistant
```

### 4. 検索

```bash
amem search 東京 --top-k 5
amem remember 東京 --top-k 5
amem search "明日の予定" --json
```

### 5. 一覧

```bash
amem list
amem ls --kind activity --limit 20
amem list --path "activity/**" --date 2026-02-21
```

### 6. 今日のスナップショット

```bash
amem today
amem today --date 2026-02-21
amem today --json
```

### 7. 構造化キャプチャ（明示指定）

```bash
amem capture --kind activity --text "渋谷で打ち合わせ"
amem capture --kind inbox --text "後で読む記事"
```

### 8. タスク用コンテキスト生成

```bash
amem context --task "明日の移動計画"
amem context --task "週次レビュー" --json
```

### 9. インデックス更新

```bash
amem index
amem index --rebuild
```

### 10. 監視

```bash
amem watch
```

### 11. Codexブリッジ起動

```bash
amem codex
amem codex --prompt "今日の優先タスクを整理して"
amem codex --resume-only
```

### 12. Geminiブリッジ起動

```bash
amem gemini
amem gemini --prompt "今日の優先タスクを整理して"
amem gemini --resume-only
```

### 13. Claudeブリッジ起動

```bash
amem claude
amem claude --prompt "今日の優先タスクを整理して"
amem claude --resume-only
```

## グローバルオプション

- `--memory-dir <path>`: `.amem` 以外のメモリールートを明示する。
- `--json`: 機械可読な JSON 出力を優先する。

## 推奨運用フロー

1. 初回: `amem init`
2. 日次記録: `source ~/.config/yuiclaw/.env; amem keep "..."`
3. 作業前確認: `amem today`
4. 必要時検索: `amem search ...`（または `amem remember ...`）
5. 定期同期: `amem index`

## トラブルシュート

- `amem: command not found`
  - `/home/yuiseki/Workspaces/repos/amem` で `cargo run -q -- ...` を使う。
- 検索結果が少ない
  - `amem index --rebuild` を実行して再構築する。
- 別ディレクトリの `.amem` を使いたい
  - `--memory-dir <abs/path/to/.amem>` を付与する。
