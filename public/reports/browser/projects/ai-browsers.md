# AI-Centric Browsers (Atlas, Comet, Genspark)

## Quick facts
- ブラウザを「情報の閲覧」から「タスクの実行（エージェント）」へ転換させる新興勢力。
- 全て Chromium をベースとしつつ、AI 推論とブラウザ操作を密に統合。
- OpenAI (Atlas), Perplexity (Comet), Genspark がそれぞれの独自 AI モデルを投入。

## 各プロジェクトのアーキテクチャ

### ChatGPT Atlas (OpenAI)
- **OWL (OpenAI's Web Layer)**: Chromium をエンジンとしつつ、UI やエージェント実行基盤を Swift (SwiftUI) や AppKit でネイティブ再構築。
- **Agent Mode**: AI が DOM を直接観測し、クリックや入力を行うための専用サンドボックスを保持。
- **AI Runtime**: LLM の推論とブラウザのライフサイクルを同期させるためのオーケストレーターを内蔵。

### Perplexity Comet
- **Hybrid Architecture**: 感度の高いデータはローカルで処理（DOM 解析等）し、高度な推論はクラウドの LLM に委ねる。
- **Real-time DOM Awareness**: 画面のピクセル情報だけでなく、DOM ツリーの構造をリアルタイムで AI モデルが把握。

### Genspark Browser
- **Mixture-of-Agents**: 9 つの専門 LLM が協調してタスクを処理。
- **Local AI Execution**: 169 種類もの AI モデルをオンデバイスで実行可能。プライバシーとオフライン動作を重視。

## 共通の実装アプローチ
1. **DOM 観測の高度化**: 標準的な Accessibility API よりも深いレベルで DOM 情報を AI モデルへ供給。
2. **操作のサンドボックス化**: AI エージェントによる誤操作や不正操作を防ぐため、実行環境を隔離。
3. **ネイティブ UI への回帰**: AI との対話やアニメーションを滑らかにするため、Chromium 標準の WebUI ではなく各 OS ネイティブの UI フレームワークを採用する傾向。

## 技術的課題
- **レイテンシ**: LLM 推論、DOM 抽出、アクション実行のサイクルに伴う遅延。
- **リソース消費**: ローカル AI 推論による高い CPU/メモリ負荷。
- **セキュリティ**: AI に Web 操作権限を与えることのリスク管理。
