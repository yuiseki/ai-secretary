# Thorium

## Quick facts
- パフォーマンス最適化に特化した Chromium フォーク。
- 特定の CPU 命令セット（AVX, SSE4.2 等）を前提とした最適化ビルドを提供。
- Google Chrome に近い使い勝手を維持しつつ、削除された機能（JPEG XL 等）を復活。

## 主要構造とファイル
- **リポジトリ**: `repos/_browser/thorium`
- **ビルドスクリプト**: `build.sh`, `autobuild.sh`
- **ビルドフラグ**: `args.gn`, `win_args.gn`
- **独自パッチ**: `docs/PATCHES.md`（適用パッチの全リスト）
- **パブリッシュ用リソース**: `pak_src/`（`.pak` ファイルの編集ツール）

## 全体アーキテクチャ

### コンパイラ・レベルの最適化
Thorium の本質は、ビルドオプションによる徹底的なチューニングにある。
- **thinLTO**: リンク時最適化により、バイナリ全体でのインライン化を促進。
- **PGO (Profile Guided Optimization)**: 実際の実行プロファイルに基づいた最適化。
- **SIMD/AVX**: 現代的なプロセッサの並列計算能力をフルに活用するフラグ設定。

### ハイブリッド・パッチセット
自前のパフォーマンス向上パッチに加え、以下のプロジェクトから優れた機能を「つまみ食い」している。
- **Vanadium**: セキュリティ/プライバシー設定のデフォルト化。
- **ungoogled-chromium**: 不要なインフォバーの削除。
- **Bromite**: DNS over HTTPS 関連。

## 独自技術・アプローチ
- **機能の復活 (Resurrection)**: 上流の Chromium で非推奨・削除された機能（MPEG-DASH, JPEG XL, FTP）をパッチによって再有効化。
- **マルチプラットフォーム最適化**: Linux だけでなく Windows, Mac, Android, Raspberry Pi 向けにそれぞれ最適化されたビルドを提供。
