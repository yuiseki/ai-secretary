# Workspaces Agent Rules

## Scope

These rules apply only to this repository (`/home/yuiseki/Workspaces`) and its subdirectories.

## 作業ガイドライン

- 可能な限り TDD で進める
  - リファクタリングや機能追加よりも先に適切なテストがあることを確認、ない場合にはテストを書く
  - 既存コードベースでテストが不足していると感じたらテストカバレッジを向上させる
- ドキュメント重要
  - 現に動いている実装を真として ADR を更新すること
- ビルドエラー・コンパイルエラー・型エラーについて
  - Error は必ず解決する
  - Warnings は可能な限り解決する
- エラーが無く、テストが通った場合には、ユーザーの意思決定や確認や許可や承認は不要で自分の判断で commit & push してよい
  - 適切なコミットメッセージを英語で書く
  - 大きめの変更を加える前には作業をロールバックできるように必ずコミットしておくべき
- 自律的かつ継続的に作業を続行する
  - ユーザーの意思決定や確認や許可や承認や操作がどうしても絶対的に必要だと判断した場合以外は自律的に作業を進めてよい
  - ユーザーの意思決定や確認や許可や承認や操作が必要だと判断した場合には、必ず作業を一時停止し、 ntfy スキルでユーザーを呼び出して待機する
    - 何をしてほしいのか要点を漏らさず簡潔に日本語で依頼すること
  - 以下の各タスクが完了したら ntfy で通知だけして次のタスクに着手してよい
- amem を最大限活用する
  - amem はコーディングAIエージェントが長期間・長時間に渡って自律的かつ継続的に作業をするための重要なツール
  - 自分の作業・活動の進捗について amem を使って適切に記録しておくこと
  
## Ongoing Logging

When meaningful work is completed in this repository, append a short activity entry using:

- `amem keep "<what was done>" --kind activity --source <codex|gemini|claude>`
