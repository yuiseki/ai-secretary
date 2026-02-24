# Vanadium

## Quick facts
- GrapheneOS プロジェクトによる、セキュリティとプライバシーに特化したブラウザ/WebView。
- Android の強力なサンドボックス機能を前提とした、攻撃面の最小化設計。
- ユーザー利便性よりも、攻撃耐性（Hardening）を最優先。

## 主要構造とファイル
- **リポジトリ**: `repos/_browser/Vanadium`
- **パッチ群**: `patches/`
    - `0172-Restriction-of-dynamic-code-execution-via-seccomp-bp.patch`: JIT 制限
    - `0211-initial-v8-patchset-for-wasm-in-interpreter-mode-sup.patch`: Wasm インタープリタ化
- **ビルド構成**: `args.gn`
    - `v8_enable_drumbrake = true`: Wasm の安全な実行

## 全体アーキテクチャ

### 攻撃面の削減 (Attack Surface Reduction)
Vanadium は、JIT（Just-In-Time）コンパイルという強力だが脆弱な機能を極力制限する。
- **JIT-less Wasm**: Wasm を機械語にコンパイルせず、インタープリタ（DrumBrake）で実行することで、メモリ破壊脆弱性を悪用したコード実行を困難にする。
- **Per-site JIT**: サイトごとに JIT の有効/無効を切り替えられる仕組みの導入。

### OS レベルの硬化との連携
GrapheneOS 自体が提供するセキュリティ機能（hardened malloc 等）を前提としており、ブラウザ単体で完結させず OS 全体で防御を固めるアプローチをとる。

## 独自技術・アプローチ
- **WebView の強化**: ブラウザアプリだけでなく、他のアプリが使用する WebView 自体も硬化されているため、システム全体の安全性が向上する。
- **フィンガープリント採取の徹底防止**: バッテリステータスやハードウェア詳細を返す API をスタブ化し、個人の特定を困難にする。
