# ChatGPT Atlas (OpenAI)

## Quick facts
- OpenAI が開発した、AI エージェントによる Web 操作（Agent Mode）を前提とした新世代ブラウザ。
- **OWL (OpenAI's Web Layer)** という独自アーキテクチャにより、Chromium エンジンを OS ネイティブ UI と高度に融合。
- UI は SwiftUI/AppKit/Metal でゼロから構築されており、標準的な Chromium とは一線を画す。

## 主要構造と技術スタック
- **コアエンジン**: Chromium (Blink / V8) - OWL Host として機能
- **UI フレームワーク**: SwiftUI, AppKit, Metal - OWL Client として機能
- **IPC 通信**: Mojo (Chromium 独自) + OpenAI 開発の Swift/TypeScript バインディング
- **言語**: C++ (Chromium), Swift (Native UI), TypeScript (Bridge/Logic)
- **AI 実行環境**: 専用の AI Runtime および Agent Sandbox プロセス

## 全体アーキテクチャ

### OWL (OpenAI's Web Layer)
OWL は、Chromium のブラウザプロセスを Atlas アプリから完全に分離し、独立したサービスレイヤとして扱う設計である。
- **デカップリング**: Chromium を独立したバイナリ（OWL Host）として出荷し、Atlas アプリ（OWL Client）がそれを利用する形式。
- **高速起動**: Chromium をバックグラウンドで非同期に起動させつつ、SwiftUI ベースの UI を瞬時に表示。
- **耐障害性**: レンダリングや Chromium 側でクラッシュが発生しても、メインの Atlas アプリや AI チャット画面の応答性は維持される。

### プロセスモデル (AI Runtime & Agentic Flow)
標準的な Chromium のプロセス（Browser, Renderer, GPU, Network）に加え、以下の AI 特化プロセスが並列動作する：
1. **AI Runtime Process**: ローカル AI モデルの管理とコンテキストの保持。
2. **Agent Sandbox**: エージェントによる Web 操作を隔離・監視する環境。
3. **Semantic Parsing Process**: DOM 情報を AI が理解しやすいセマンティックデータへ変換。
4. **LLM Orchestrator**: クラウドの LLM 推論とローカルアクションの実行を調整。

### Agent Mode の仕組み
AI エージェントが Web ページを「見て、考えて、操作する」ため、以下の処理サイクルを高速に回している。
- **DOM Observation**: 現在のページの DOM 構造と視覚情報を取得。OWL を介して、通常は AI から見えないドロップダウンメニュー等の UI 要素も合成画像として AI に供給。
- **Inference & Planning**: ユーザーの目的を達成するためのステップ（クリック、入力、スクロール）を計画。
- **Sandbox Execution**: 計画された操作を Sandbox 内で実行。重要なアクション（決済、ログイン等）ではユーザーの承認を求める。

## 独自技術・アプローチ
- **Native UI Rebuild**: Chromium 標準の WebUI やツールバーを一切使わず、Apple のネイティブフレームワークで UI を再構築。これにより、AI エージェントの動作状況を滑らかなアニメーションで表現可能。
- **Mojo Swift Bindings**: Chromium 内部のメッセージパッシングシステム（Mojo）を Swift から直接叩くための独自バインディング。これにより、C++ レイヤの機能をネイティブ UI から低遅延で制御。
- **Context Awareness & Memory**: ブラウザでの行動履歴を AI が学習し、複数のタブやセッションを跨いで文脈を維持する「Browser Memory」機能を搭載。

## セキュリティ設計
AI にブラウザ操作権限を与えるリスクに対し、以下の多層防御を導入。
- **User Confirmation Gate**: 高リスクな操作（送信、購入）の直前にユーザーの物理的な確認を必須化。
- **Prompt Injection Monitoring**: Web ページ内に埋め込まれた悪意あるプロンプト（AI への不正指示）を検知し、エージェントが従わないようガードレールを設置。
- **Sandbox Isolation**: エージェントのアクションを特定のタブ（Renderer プロセス）に限定し、ブラウザ全体やローカルシステムへのアクセスを遮断。
