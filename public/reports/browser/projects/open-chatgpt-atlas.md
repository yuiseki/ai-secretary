# Open ChatGPT Atlas (by Composio)

## Quick facts
- OpenAI Atlas のコンセプトを、既存の Chrome 拡張機能としてオープンソースで再現したプロジェクト。
- **Gemini 2.5 Computer Use** モデルを活用し、スクリーンショットと座標ベースの Web 操作（Agent Mode）を実装。
- **MCP (Model Context Protocol)** を介して Composio のクラウドツール群と連携し、高度な自動化を実現。

## 主要構造と技術スタック
- **形態**: Chrome 拡張機能 (Manifest V3)
- **UI フレームワーク**: React, Tailwind CSS (Vite でビルド)
- **AI 連携**: Vercel AI SDK, Gemini 2.5 Computer Use Preview
- **ツール連携**: MCP SDK, Composio Tool Router
- **主要コンポーネント**:
    - `sidepanel.tsx`: メインのチャット UI とエージェントの制御ループ。
    - `content.ts`: DOM の観測、コンテキスト抽出、およびシミュレーションされた操作の実行。
    - `tools.ts`: Composio クラウドセッションの管理。

## 全体アーキテクチャ

### 拡張機能ベースの Agentic Workflow
本家 Atlas がブラウザエンジン（OWL）そのものを書き換えているのに対し、このプロジェクトはブラウザ拡張機能の権限（`chrome.tabs`, `chrome.debugger` 等）を駆使して同様の機能を実現している。
- **Side Panel Integration**: Chrome の `sidePanel` API を使用し、ブラウズ画面の横に AI チャットを常駐。
- **Content Script Bridge**: `content.ts` が各タブに注入され、ページの DOM 情報を AI に供給し、AI からの指示（クリック、入力等）をブラウザイベントとして発火。

### Gemini Computer Use の統合
最も特徴的な機能。エージェントが Web を「操作」するために以下のステップを踏む：
1. **Screenshot Capture**: 現在のタブのスクリーンショットを取得（Base64）。
2. **Coordinate Scaling**: Gemini 側の 1000x1000 正規化座標を、ブラウザの実際のビューポートサイズにスケーリング。
3. **Action Execution**: スケーリングされた座標に対し、`mousedown` / `mouseup` / `click` イベントを連続して発行し、人間の操作を模倣。

### MCP (Model Context Protocol) 連携
Composio のクラウドツール群を呼び出すためのプロトコルとして MCP を採用。ブラウザ操作以外のタスク（メール送信、カレンダー操作等）も、このプロトコルを介して一貫したインターフェースで実行できる。

## 実装詳細（リバースエンジニアリング結果）

### DOM 観測 (`extractPageContext`)
AI モデルのトークン制限を考慮し、ページ情報を以下の優先順位で抽出・圧縮している：
- `innerText` を最大 10,000 文字に制限。
- 主要なリンク（最初の 50 件）と画像（最初の 20 件）のみをリストアップ。
- フォーム構造（ID, アクション, 入力タイプ）を抽出。

### 操作のシミュレーション
- **React 互換の入力**: `value` セッターを直接呼び出し、`input` / `change` イベントを強制的に発火させることで、仮想 DOM を使用するモダンなサイトでも確実に入力を行う。
- **ドラッグ＆ドロップ**: `DataTransfer` オブジェクトを生成し、一連の `dragstart` / `dragover` / `drop` イベントをエミュレート。
- **視覚的フィードバック**: `highlightElement` 関数により、エージェントが操作した箇所を青いパルスアニメーションで表示。

## 独自技術・アプローチ
- **Hybrid AI Processing**: Gemini Computer Use（座標ベース）と、MCP ツール（API ベース）を状況に応じて使い分ける設計。
- **Human-in-the-Loop**: 決済やログインなどの機密性の高い操作（URL やページ内のキーワードで判定）の直前に、`window.confirm` によるユーザーの物理的承認を求めるガードレール。
