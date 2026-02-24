# ungoogled-chromium

## Quick facts
- Google へのバックグラウンド通信を徹底的に排除することを目的とした非営利プロジェクト。
- 「Chromium のデフォルト体験を維持しつつ Google 依存を消す」というミニマルな思想。
- 多くのプライバシー重視ブラウザ（Thorium, Bromite 等）の「パッチの供給源」として機能。

## 主要構造とファイル
- **リポジトリ**: `repos/_browser/ungoogled-chromium`
- **パッチ群**: `patches/`
    - `patches/core/ungoogled-chromium/`: Google サービス削除のコアパッチ
    - `patches/extra/iridium-browser/`: Iridium から取り込んだパッチ
- **ソースファイルプロセッサ**: `devutils/`
    - `domain_substitution.py`: ドメイン置換スクリプト
    - `pruning.py`: バイナリ削除スクリプト
- **設定定義**:
    - `domain_substitution.list`: 置換対象ドメインのリスト
    - `pruning.list`: 削除対象バイナリのリスト
    - `flags.gn`: デフォルトのビルドフラグ

## 全体アーキテクチャ

### 透過的なパッチシステム
ungoogled-chromium は、Chromium のソースコードそのものを保持せず、ビルド時に「上流の Chromium ＋ このリポジトリのパッチ」を組み合わせる方式をとる。これにより、どのコードが「ungoogled 化」による変更点なのかを完全に透過的にしている。

### Domain Substitution (ドメイン置換)
最も特徴的な技術。ソースコード内の `google.com` などの文字列を、存在しないドメイン `qjz9zk` に機械的に置換する。
- 万が一パッチ漏れで通信が発生しても、DNS 解決に失敗するため通信が成立しない。
- `qjz9zk` への通信をブラウザレベルで明示的にブロックするパッチも含まれている。

### Binary Pruning (バイナリ削除)
Chromium に含まれる不透明な事前ビルド済みバイナリ（`.so`, `.exe`, `.jar` 等）を削除し、可能な限りオープンソースのコードから再ビルドするか、機能そのものを無効化する。

## 独自技術・アプローチ
- **フェイルセーフな設計**: ドメイン置換による「失敗しても安全」な設計。
- **構成の再利用性**: 依存関係をパッチリストとして管理しているため、他のプロジェクトが特定の修正（例：Safe Browsing 無効化）だけを取り込むことが容易。
