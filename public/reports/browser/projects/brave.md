# Brave Browser (brave-core)

## Quick facts
- Chromium をベースにプライバシー保護と独自の経済圏（Rewards）を統合した商用ブラウザ。
- 広告ブロックエンジンを Rust で実装し、C++ 側の Blink レイヤに深く統合している。
- `brave-core` という独立したコンポーネント群を `src/brave` に配置する構成。

## 主要構造とファイル
- **メタ・リポジトリ**: `repos/_browser/brave-browser`
- **コア・リポジトリ**: `repos/_browser/brave-core`
- **広告ブロック (Rust)**: `repos/_browser/adblock-rust`
- **パッチ定義**: `brave-core/patches/`
    - `chrome-browser-ui-BUILD.gn.patch`: UI レイヤのカスタマイズ
    - `third_party-blink-renderer-core-BUILD.gn.patch`: レンダリングエンジンの修正
- **独自コンポーネント**: `brave-core/components/`
    - `brave_adblock_ui/`: 広告ブロックの設定UI
    - `brave_rewards/`: 報酬システムのロジック
    - `brave_shields/`: 保護機能（Shields）のコアロジック
- **ビルド定義**: `brave-core/BUILD.gn`

## 全体アーキテクチャ

### コンポーネントの分離と統合
Brave は、Chromium のソースコードを直接改変する箇所を最小限（といっても膨大だが）に抑え、独自のロジックを `brave-core` ディレクトリに集約している。ビルド時に `src/brave` としてシンボリックリンク（またはコピー）され、Chromium の GN ビルドシステムに組み込まれる。

### Shields (Adblock & Fingerprinting Protection)
Brave Shields は、ネットワークスタックとレンダリングパイプラインの双方にフックを持つ。
- **Network Layer**: `net/` へのパッチにより、リクエストが送信される前に広告ブロックエンジンが判定を行う。
- **Blink Layer**: JS プロキシや DOM の改変を行い、フォントやキャンバスを介したフィンガープリント採取を妨害する。

### Rust の統合
広告ブロックの高速なフィルタリングを実現するため、Rust 製の `adblock-rust` ライブラリを使用している。C++ と Rust のブリッジには CXX などのツールが活用されており、安全かつ高速なメモリ管理を実現している。

## 独自技術・アプローチ
- **C++/Rust ハイブリッドアーキテクチャ**: パフォーマンスが要求されるフィルタリング処理に Rust を採用。
- **膨大なパッチセットによる深層カスタマイズ**: 他のフォークがフラグ制御に留まるのに対し、Blink や V8 レイヤまで踏み込んだ修正を行っている。
- **WebUI の TypeScript 化**: Chromium 標準の WebUI を Brave 独自のコンポーネント（React/TypeScript）で置換。
