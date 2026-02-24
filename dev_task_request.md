# 開発作業依頼書



## タスク概要

優先順で書かれているので順番に作業すること。

- repos/yuiclaw の開発続行
  - repos/acomm の TUI を拡張する
    - repos/_tui に clone されている git リポジトリのTUI実装を調査
      - 調査対象: claude-code (React+Yoga WASM), codex (Ratatui/Rust), gemini-cli (Ink/React), opencode (Solid.js+@opentui)
      - 共通点を整理
        - 4つ全てが共通して実装している機能
          - Markdown レンダリング（ヘッダー・コードブロック・リスト・表）
          - コードブロックの Syntax Highlighting
          - 処理中スピナー / ローディングアニメーション
          - スクロール可能なメッセージ履歴
          - スラッシュコマンド体系（/help, /clear, /model など）
          - テーマ / カラーカスタマイズ（ダーク/ライト自動検出を含む）
          - セッション履歴の保存・参照
        - 共通点のうち acomm TUI に不足している項目を列挙
          - [ ] **Markdown レンダリング**: メッセージ本文のマークダウンを整形表示する（現状は生テキスト表示のみ）
          - [ ] **Syntax Highlighting**: コードブロック内のシンタックスカラーリング（言語識別付き）
          - [ ] **スラッシュコマンド autocomplete**: 入力中に候補ドロップダウンを表示する（現状は補完なし）
          - [ ] **仮想スクロール (VirtualizedList)**: 長い会話履歴を効率的に描画するための仮想化リスト
          - [ ] **テーマシステム**: ダーク/ライト自動検出 + `/theme` コマンドによる切り替え
      - 相違点を整理
        - 各ツール固有の特徴的な機能
          - claude-code: `@` ファイルメンション + .gitignore 対応オートコンプリート、プランモード (`/plan`)、Thinking blocks の折りたたみ表示、外部エディタ起動 (Ctrl+G)、プロンプトスタッシュ (Ctrl+S)
          - codex: シマーアニメーション（ストリーミングテキストへの時間ベース光沢エフェクト、RGB ブレンド）、32種類 Syntax Highlighting テーマ (Dracula/Nord/Gruvbox/Catppuccin 等 syntect)、承認ダイアログ overlay、セッション JSON ログ
          - gemini-cli: Google カラー 6色グラデーションスピナー、RewindViewer（会話履歴の任意の時点へ巻き戻し・フォーク）、バックグラウンドシェル統合 (Ctrl+B/L/K)、セッションブラウザ（ページネーション・検索・日付/件数ソート）
          - opencode: コマンドパレット (Ctrl+P, fuzzy search)、セッション分岐/タイムラインナビゲーション、Knight Rider スキャナースピナー（光がバウンス+トレイル+ブルーム）、コスト/トークン使用量表示、セッション Markdown エクスポート、プロンプトスタッシュ複数件管理
        - 相違点のうち acomm TUI に取り込む価値のありそうな項目を列挙
          - [ ] **コスト/トークン使用量表示** (opencode 由来): ステータスバーにコンテキスト使用率 (%) や概算コスト (USD) をリアルタイム表示する
          - [ ] **シマーアニメーション** (codex 由来): ストリーミング中のテキストに時間ベースの光沢エフェクトを重ねて「生成中」感を演出する
