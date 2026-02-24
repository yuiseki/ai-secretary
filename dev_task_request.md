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


## 追加調査メモ: `repos/_claw/pi-mono/packages/tui` （`repos/acomm/tui` 参考実装）

`pi-tui` は Ink ではなく独自 TUI フレームワークだが、`repos/acomm/tui` にそのまま移植できるコードよりも、入力処理・ANSI処理・autocomplete・テスト戦略の「設計パターン」が非常に参考になる。

### まず読むべきファイル（優先度順）

- `repos/_claw/pi-mono/packages/tui/src/components/editor.ts`
  - 多機能な編集体験（multiline, 履歴, undo, kill-ring, autocomplete, bracketed paste, grapheme-aware wrap）の中心実装
- `repos/_claw/pi-mono/packages/tui/src/autocomplete.ts`
  - slash command + file path + `@` file reference をまとめた provider 設計
- `repos/_claw/pi-mono/packages/tui/src/components/select-list.ts`
  - 候補UI（選択、スクロール、説明文、no-match）
- `repos/_claw/pi-mono/packages/tui/src/utils.ts`
  - ANSI/OSC/APC/CJK 幅計算と wrap（style leak を防ぐ）
- `repos/_claw/pi-mono/packages/tui/src/keys.ts`
  - Kitty keyboard protocol / legacy escape sequence 両対応の正規化
- `repos/_claw/pi-mono/packages/tui/src/stdin-buffer.ts`
  - batched / split escape sequence 対応（SSH/高速入力で効く）
- `repos/_claw/pi-mono/packages/tui/test/*.test.ts`
  - 実運用で起きる崩れ（overlay, ANSI leak, wrap, kitty key, paste）に対する回帰テスト群

### `repos/acomm/tui` に特に取り込む価値が高い実装

- [ ] **入力処理の強化（最優先）**
  - 現状 `repos/acomm/tui/src/MultilineInput.tsx` は実用的だが、履歴/undo/word移動/kill-ring/貼り付け原子的undo が未実装
  - `pi-tui` の `Editor` は以下が揃っている
    - grapheme-aware cursor movement（emoji/CJKで壊れにくい）
    - visual line wrap 前提の上下移動（wrapped line 上のカーソル移動が自然）
    - prompt history と multiline navigation の共存
    - bracketed paste buffering + atomic undo
    - kill-ring (`Ctrl+W/U/K`, `Ctrl+Y`, `Alt+Y`)
    - undo stack coalescing（単語入力まとめて undo）
  - `acomm/tui` では `MultilineInput` の完全置換ではなく、まず `textHelpers.ts` に pure helpers を増やして段階導入するのが良い

- [ ] **Autocomplete の抽象化（slash だけで終わらせない）**
  - 現状 `repos/acomm/tui/src/SlashAutocomplete.tsx` + `slashCommands.ts` は slash command 専用・簡易UI
  - `pi-tui` の `AutocompleteProvider` / `CombinedAutocompleteProvider` は次を統一的に扱える
    - slash command 名 fuzzy match
    - slash command 引数補完
    - file path 補完
    - `@` ファイル参照補完（`fd` + `.gitignore` 尊重 + fuzzy）
  - `acomm/tui` に取り込むなら、まず slash command 補完を `provider interface` 化し、将来的に `@file` を追加できる設計にする

- [ ] **候補リスト UI の汎用化（SlashAutocomplete / SelectionMenu / SessionBrowser の統合）**
  - `pi-tui/src/components/select-list.ts` は以下が実用的
    - 説明文付き項目
    - 選択行の視認性
    - スクロール位置表示 `(n/total)`
    - no-match 表示
    - `onSelectionChange` フック
  - `acomm/tui` 側は `SlashAutocomplete`, `SelectionMenu`, `SessionBrowser` が分散しているので、共通 `ListOverlay` 的なコンポーネントに寄せる価値が高い

- [ ] **ANSI/CJK 安全な幅計算・折り返し**
  - 現状 `repos/acomm/tui/src/VirtualizedMessageList.tsx` は `split('\\n')` ベースで、ANSI/OSC hyperlink/全角幅を厳密に扱っていない
  - `pi-tui/src/utils.ts` + `wrap-ansi` 系テストは以下が強い
    - ANSI SGR の継続/解除を保持した折り返し
    - OSC8 hyperlink / APC（cursor marker）を幅計算から除外
    - underline/background style の line wrap 時 leak 防止
    - CJK/emoji を含む visible width 計算
  - `acomm/tui` は `renderMarkdown()` で ANSI を生成しているため、ここを強化すると表示崩れの予防効果が大きい

- [ ] **キー入力の正規化（Kitty/legacy 両対応）**
  - `pi-tui/src/keys.ts` は Kitty keyboard protocol と legacy escape sequence の両対応が非常に厚い
  - 特に以下が参考になる
    - key matcher を string 生シーケンスから `KeyId` に正規化
    - 非Latin配列（base layout key を使った Ctrl ショートカット判定）
    - key release / repeat の扱い
  - `acomm/tui` は Ink の `useInput` を使うため丸ごと移植は難しいが、`input` 生文字列ベースの補助判定層として一部導入は検討価値あり（特に Shift+Enter / Ctrl系の安定化）

- [ ] **回帰テスト戦略（かなり重要）**
  - `pi-tui` はバグ再現ベースのテストが豊富で、実際の運用で壊れる場所を押さえている
  - 参考にすべきテスト群
    - `test/tui-render.test.ts`: resize/shrink/diff render/cursor tracking/style reset
    - `test/overlay-options.test.ts`: overlay の幅超過・ANSI複雑行・wide char 境界
    - `test/tui-overlay-style-leak.test.ts`: overlay 合成時の style leak 回帰
    - `test/stdin-buffer.test.ts`: split/batched escape sequences
    - `test/keys.test.ts`: Kitty/legacy の膨大なキー判定
    - `test/editor.test.ts`: 履歴/undo/paste/autocomplete/word-wrap の回帰
    - `test/markdown.test.ts`, `test/wrap-ansi.test.ts`: Markdown/ANSI折り返しの壊れやすいケース
  - `acomm/tui` ではまず pure function テスト拡張（`textHelpers`, markdown ANSI wrapping, completion state machine）から始めるのが現実的

### 直接移植しない方がよい（または優先度低）

- [ ] **`pi-tui` の独自 differential renderer / overlay compositor をそのまま移植**
  - `repos/_claw/pi-mono/packages/tui/src/tui.ts` は独自 terminal abstraction 前提
  - `repos/acomm/tui` は Ink ベースなので、レンダラ本体の直接移植コストが高い
  - ただし「何をテストで守るか」の観点は強く参考になる

- [ ] **terminal image / kitty graphics**
  - `pi-tui` は高度だが、`acomm/tui` の現在のスコープでは優先度低

### `repos/acomm/tui` 向けの具体的な次アクション案（pi-tui 参考版）

- [ ] **Phase 1: 入力・表示の基礎強化**
  - `textHelpers.ts` を拡張し、grapheme-aware cursor movement / word movement / CJK-safe wrap を pure 関数化
  - `VirtualizedMessageList` 用に ANSI-aware `visibleWidth` / wrap utility を追加（少なくとも codeblock/hyperlink style leak を防ぐ）
  - 対応テスト追加（CJK, emoji, ANSI hyperlink, underline/background wrap）

- [ ] **Phase 2: autocomplete 基盤の抽象化**
  - `slashCommands.ts` を provider API に寄せる
  - `SlashAutocomplete.tsx` を汎用候補リストUI化（説明文/スクロール/no-match）
  - Tab / Enter / Esc / ↑↓ の state machine を pure 化してテスト追加

- [ ] **Phase 3: editor UX 強化**
  - `MultilineInput.tsx` に history + undo の導入（少なくとも atomic paste undo と履歴重複抑制）
  - 将来的に kill-ring / word delete / word move を追加

- [ ] **Phase 4: file completion / @mention（将来）**
  - `CombinedAutocompleteProvider` 的な設計を導入
  - `fd` 使用は optional dependency / graceful fallback 前提

### 参考ファイル（ピンポイント）

- `repos/_claw/pi-mono/packages/tui/src/components/editor.ts`
- `repos/_claw/pi-mono/packages/tui/src/autocomplete.ts`
- `repos/_claw/pi-mono/packages/tui/src/components/select-list.ts`
- `repos/_claw/pi-mono/packages/tui/src/utils.ts`
- `repos/_claw/pi-mono/packages/tui/src/keys.ts`
- `repos/_claw/pi-mono/packages/tui/src/stdin-buffer.ts`
- `repos/_claw/pi-mono/packages/tui/test/editor.test.ts`
- `repos/_claw/pi-mono/packages/tui/test/tui-render.test.ts`
- `repos/_claw/pi-mono/packages/tui/test/overlay-options.test.ts`
- `repos/_claw/pi-mono/packages/tui/test/wrap-ansi.test.ts`


## 追加調査メモ: `package.json` 比較（`pi-tui` + `repos/_tui/*` → `repos/acomm/tui`）

`repos/_claw/pi-mono/packages/tui/package.json` と `repos/_tui` 配下の主要 `package.json`（特に `gemini-cli/packages/cli`, `gemini-cli/packages/core`, `opencode/packages/opencode`, `opencode/packages/ui`, `opencode/packages/app`）を確認した。`repos/acomm/tui/package.json` に未導入で、導入価値が高そうな package を優先度付きで整理する。

### 先に結論（導入価値が高い順）

- [ ] **`strip-ansi`**（高）
  - 参照: `gemini-cli`, `opencode` で広く使用（`repos/_tui/gemini-cli/packages/cli/package.json`, `repos/_tui/opencode/packages/opencode/package.json`, `repos/_tui/opencode/packages/ui/package.json` など）
  - `acomm/tui` では Markdown + Syntax Highlight 後の ANSI 文字列を扱うため、以下に効く
    - 幅計算前の正規化
    - テスト比較（スナップショット/レンダリング結果比較時）
    - 検索/フィルタ時に表示装飾を無視する処理
  - 既存 `string-width` と役割が競合しない（補完関係）

- [ ] **`@xterm/headless`**（高, devDependency）
  - 参照: `repos/_claw/pi-mono/packages/tui/package.json`, `repos/_tui/gemini-cli/packages/cli/package.json`, `repos/_tui/gemini-cli/packages/core/package.json`
  - `acomm/tui` の表示崩れ回帰テストに有効（ANSI, wrap, cursor, resize を terminal 実装準拠で検証しやすい）
  - `pi-tui`/`gemini-cli` が両方採用している点は強いシグナル
  - Ink の単体テストだけでは拾いにくい「端末実際表示」寄りのバグに効く

- [ ] **`fzf` または `fuzzysort`**（高）
  - `fzf` 参照: `repos/_tui/gemini-cli/packages/cli/package.json`（slash / `@` completion に `AsyncFzf` を利用）
  - `fuzzysort` 参照: `repos/_tui/opencode/packages/opencode/package.json`, `repos/_tui/opencode/packages/ui/package.json`
  - `acomm/tui` の slash autocomplete / session browser / 将来の `@file` 補完の品質向上に直結
  - 推奨の使い分け:
    - `fzf`: Gemini のように補完結果ハイライト位置や fuzzy 品質を重視する場合
    - `fuzzysort`: 実装が軽く、同期 API で扱いやすく、一覧ダイアログ類へ横展開しやすい

- [ ] **`ansi-regex`**（中）
  - 参照: `repos/_tui/gemini-cli/packages/cli/package.json`
  - `strip-ansi` だけでは扱いにくいケース（ANSI token 境界の検査、部分除去、wrap utility の前処理）で有用
  - `acomm/tui` の ANSI-aware wrap utility を自作するなら補助依存として価値がある

- [ ] **`ink-spinner` + `cli-spinners`**（中）
  - 参照: `repos/_tui/gemini-cli/packages/cli/package.json`
  - `acomm/tui` は Ink ベースなので相性が良い
  - 単なる見た目だけでなく、プロバイダ別のローディング表現（Gemini 風、シンプル、低視認負荷）を切替可能にしやすい
  - 既に独自 spinner が十分なら優先度は下げてよい

- [ ] **`get-east-asian-width`**（中, `pi-tui` 由来）
  - 参照: `repos/_claw/pi-mono/packages/tui/package.json`
  - `acomm/tui` は `string-width` を使っているが、ANSI/OSC を含む細かい wrap/カーソル計算を自前で詰める場合に、可視幅計算を分離する部品として検討価値がある
  - 導入するなら `textHelpers.ts` の pure utility で限定使用がよい

- [ ] **`@xterm/xterm`**（中, devDependency）
  - 参照: `repos/_claw/pi-mono/packages/tui/package.json`
  - `@xterm/headless` 単体で足りるケースが多いが、ブラウザ側/実端末との差分確認やデバッグ補助に使える
  - `acomm/tui` ではまず `@xterm/headless` を優先し、必要になったら追加で十分

### 条件付きで価値あり（用途が明確なら）

- [ ] **`shiki` / `marked-shiki` / `@shikijs/transformers`**（中〜低）
  - 参照: `repos/_tui/opencode/packages/ui/package.json`, `repos/_tui/opencode/packages/app/package.json`
  - 現状 `acomm/tui` は `marked` + `marked-terminal` + `cli-highlight` で terminal 出力が成立している
  - `shiki` 系は Web/HTML レンダリング相性が強く、Ink TUI に直接導入すると変換コストが増えやすい
  - ただし将来「テーマ品質を大きく上げたい」「コードブロック色を統一管理したい」なら再検討の価値あり

- [ ] **`mime-types` / `@types/mime-types`**（低, `pi-tui` 由来）
  - 参照: `repos/_claw/pi-mono/packages/tui/package.json`
  - `@file` 補完や添付ファイル表示で icon/type 分岐をやるなら役に立つ
  - 現時点の `acomm/tui` スコープでは優先度は低い

- [ ] **`lowlight` / `highlight.js`**（低）
  - 参照: `repos/_tui/gemini-cli/packages/cli/package.json`
  - `cli-highlight` を既に使っているため重複気味
  - `cli-highlight` の限界が出るまで導入しなくてよい

### 導入優先度が低い / 相性が悪い（今回は見送り）

- [ ] **`koffi`**（`pi-tui` 依存）
  - FFI 系で `pi-tui` の terminal/OS 連携文脈。`acomm/tui`（Ink/Node）には過剰

- [ ] **`virtua`**（opencode UI/App）
  - DOM/ブラウザ UI 向け仮想リスト。Ink TUI にはそのまま適用しづらい

- [ ] **`opentui-spinner`**, `@opentui/*` 系
  - `opencode` 独自の OpenTUI スタック向け。Ink ベースの `acomm/tui` には直接移植しにくい

- [ ] **`ghostty-web`** など Web terminal / app-specific 依存
  - `acomm/tui` の CLI/TUI 改善には直接寄与しない

### `_tui` 調査で見えた実装ヒント（package 以上の示唆）

- [ ] **Gemini CLI は `fzf` を slash/`@` 補完で実運用している**
  - 参照: `repos/_tui/gemini-cli/packages/cli/src/ui/hooks/useSlashCompletion.ts`, `repos/_tui/gemini-cli/packages/cli/src/ui/hooks/useAtCompletion.ts`
  - `acomm/tui` の補完 state machine 抽象化後に導入すると効果が大きい

- [ ] **Gemini CLI は `strip-ansi` + `ansi-regex` を text utility とテストで使っている**
  - 参照: `repos/_tui/gemini-cli/packages/cli/src/ui/utils/textUtils.ts`, `repos/_tui/gemini-cli/packages/cli/src/test-utils/render.tsx`
  - `acomm/tui` の表示/折り返し/検索 utility と相性が良い

- [ ] **Gemini CLI は `@xterm/headless` を test rig に使っている**
  - 参照: `repos/_tui/gemini-cli/packages/cli/src/test-utils/render.tsx`
  - `acomm/tui` の回帰テスト強化方針（pi-tui 調査メモ）と整合する

- [ ] **opencode は `fuzzysort` を dialog/autocomplete/provider 選択に横断利用している**
  - 参照: `repos/_tui/opencode/packages/opencode/src/cli/cmd/tui/component/prompt/autocomplete.tsx`, `repos/_tui/opencode/packages/opencode/src/cli/cmd/tui/ui/dialog-select.tsx`
  - `acomm/tui` でも slash autocomplete / model picker / session browser の検索基盤共通化に向く

### `repos/acomm/tui` 向け package 導入の現実的なフェーズ案

- [ ] **Phase A（低リスク・即効）**
  - `strip-ansi`
  - `ansi-regex`（必要なら同時）
  - pure utility テスト強化（既存 `vitest` のまま）

- [ ] **Phase B（補完品質向上）**
  - `fuzzysort` *or* `fzf`（どちらか一方から開始）
  - `SlashAutocomplete` の provider 化 + fuzzy 検索

- [ ] **Phase C（回帰テスト強化）**
  - `@xterm/headless`（devDependency）
  - ANSI wrap / resize / cursor / style leak 系のテスト導入

- [ ] **Phase D（演出改善・任意）**
  - `ink-spinner`
  - `cli-spinners`

- [ ] **Phase E（高度化・再評価）**
  - `get-east-asian-width`（自前幅計算が必要になったら）
  - `shiki` 系（テーマ品質を上げたくなったら）

### 補足（今回の調査範囲）

- `repos/_tui/codex` は TUI 本体が Rust 実装で、npm 側 `package.json` は wrapper/メンテ用途が中心のため、`acomm/tui` 向け package 比較としてのシグナルは弱い
- `_tui` 配下では `wrap-ansi` / `slice-ansi` は package 依存としては見つからなかった（`pi-tui` は自前実装寄り）
