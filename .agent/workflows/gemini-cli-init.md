---
description: Antigravity（エージェント）から直接操作可能な、権限エラーを回避したGemini CLIの起動手順
---

Antigravity環境において、標準の `~/.gemini/tmp` への書き込み権限エラー（EPERM）を回避し、Gemini CLIを直接操作するためのワークフローです。
この手順により、AntigravityがGemini CLIを自身の「手足」として制御できるようになります。

// turbo-all
1. ターミナルを開いて、Gemini CLIを対話モードで起動します。
   この際、`send_command_input` ツールで継続的に操作できるよう、バックグラウンドでの起動、または Antigravity の `run_command` による実行を行います。
   ```bash
   GEMINI_FORCE_FILE_STORAGE=true gemini
   ```

2. 起動後、操作が必要な場合は `send_command_input` を使用します。
   - 入力（Input）の末尾には必ず改行コード（`\n`）を含めてください。
   - **重要**: 入力を送信した後、確実に応答を開始（実行）させるために、さらにもう一度 `send_command_input` でエンターを2回（`\n\n`）送信してください。
   モデルがいっぱいの場合は、`/model gemini-2.0-flash` などを送信して切り替えます。
