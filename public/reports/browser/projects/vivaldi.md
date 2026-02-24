# Vivaldi

## Quick facts
- 元 Opera CEO によって設立された、パワーユーザー向けの高度なカスタマイズブラウザ。
- ブラウザの UI そのものを Web 技術（React 等）で構築するという特異なアーキテクチャ。
- Chromium ベースだが、UI レイヤは完全に独自（プロプライエタリ）。

## 主要構造と技術スタック
- **エンジン**: Chromium (Blink / V8)
- **UI フレームワーク**: React.js, JavaScript, HTML5, CSS3
- **ビルド・ツール**: Webpack, Babel, Flow (型チェック)
- **ランタイム**: Node.js (開発・ビルド工程で使用)

## 全体アーキテクチャ

### Web-based UI Layer
Vivaldi の最大の特徴は、タブ、アドレスバー、サイドパネルといったブラウザのユーザーインターフェースそのものが、Chromium 上で動作する一つの巨大な Web アプリケーションとして実装されている点にある。
- **柔軟性**: CSS や JavaScript による動的な UI 変更が容易。
- **オーバーヘッド**: ネイティブ UI に比べメモリ消費量が増える傾向にあるが、開発効率とカスタマイズ性を優先している。

### Chromium との統合
Chromium のコア部分は C++ で実装されており、Vivaldi 独自の UI レイヤとは高度に抽象化されたブリッジを介して通信する。

## 独自技術・アプローチ
- **Proprietary UI over Open Source Core**: エンジンはオープンソースの Chromium を使用しつつ、付加価値の源泉である UI 部分はクローズドソースで開発。
- **高度なタブ管理とサイドバー**: Web 技術を活かした、標準的な Chromium では困難な複雑な UI 操作を実現。
